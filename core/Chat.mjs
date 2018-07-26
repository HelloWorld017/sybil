import fs from "fs";
import path from "path";
import util from "util";
import Rule from "./Rule";
import Vote from "./Vote";

class Chat {
	constructor(bot, chatId) {
		this.bot = bot;
		this.id = chatId;
		this.votes = [];
		this.rules = [];
		this.users = {};
		this.tempRules = [];
		this.noTemp = [];
		this.maxVoteId = 0;
		this.ruleFinder = target => rule =>
			(rule.messageType === target.messageType && rule.description === target.description);
	}

	async getAdministrators() {
		return this.bot.fetch('getChatAdministrators', {chat_id: this.id});
	}

	addRule(rule) {
		this.rules.push(rule);
	}

	async createVote(rule, isDeleteVote) {
		const vote = new Vote(rule, this, this.maxVoteId++, isDeleteVote);
		await vote.init();

		this.votes.push(vote);
		await this.save();
	}

	findRule(target) {
		const finder = this.ruleFinder(target)
		const inRules = this.rules.find(finder);
		const inTempRules = this.tempRules.find(finder);
		const inNoTemps = this.noTemp.find(finder);

		return inRules || inTempRules || inNoTemps;
	}

	findVote(messageType, description) {
		const finder = this.ruleFinder({messageType, description});

		return this.votes.find(({rule}) => finder(rule));
	}

	async removeVote(vote) {
		this.votes.splice(this.votes.indexOf(vote), 1);
		if(vote.tempRuleAdded) {
			this.tempRules.splice(this.tempRules.indexOf(vote.rule), 1);
		}
		await this.save();
	}

	addTempRule(rule) {
		if(this.findRule(rule)) return false;

		this.tempRules.push(rule);
		this.noTemp.push(rule);
		return true;
	}

	async handle(message) {
		let deleteMsg = false;

		const handleRule = v => {
			if(v.test(message)) {
				if(!this.users[message.from.id])
					this.users[message.from.id] = {
						coefficient: 0
					};

				this.users[message.from.id].coefficient += v.coefficient;
				if(v.action === '삭제') deleteMsg = true;
			}
		};

		this.tempRules.forEach(handleRule);
		this.rules.forEach(v => {
			if(this.tempRules.some(this.ruleFinder(v))) {
				return;
			}

			handleRule(v);
		});

		if(deleteMsg) {
			await this.bot.fetch('deleteMessage', {
				chat_id: this.id,
				message_id: message.message_id
			});
		}
	}

	async save() {
		const exportData = {
			votes: this.votes.map(v => v.exportData),
			rules: this.rules.map(v => v.exportData),
			tempRules: this.tempRules.map(v => v.exportData),
			noTemp: this.noTemp.map(v => v.exportData),
			maxVoteId: this.maxVoteId,
			users: this.users,
			id: this.id
		};

		const writeFile = util.promisify(fs.writeFile);
		await writeFile(path.resolve(this.bot.basePath, 'chats', `${this.id}.json`), JSON.stringify(exportData));
	}

	static async loadFrom(bot, chatId) {
		const readFile = util.promisify(fs.readFile);
		const exportData = JSON.parse(
			await readFile(path.resolve(bot.basePath, 'chats', `${chatId}.json`), 'utf8')
		);

		const chat = new Chat(bot, chatId);
		chat.maxVoteId = exportData.maxVoteId;
		chat.rules = exportData.rules.map(v => Rule.importFrom(bot, v));
		chat.tempRules = exportData.tempRules.map(v => Rule.importFrom(bot, v));
		chat.noTemp = exportData.noTemp.map(v => Rule.importFrom(bot, v));
		chat.users = exportData.users;

		for(let vote of exportData.votes) {
			chat.votes.push(await Vote.importFrom(bot, vote));
		}

		return chat;
	}
}

export default Chat;