import CommandQuery from "./CommandQuery.mjs";
import CommandSimpleVote from "./CommandSimpleVote.mjs";

class CommandQuerySimpleVote extends CommandQuery {
	constructor(bot) {
		super(bot, "간단투표참가", ['SimvoteId', 'OptionId']);
	}

	async doExecute({OptionId, SimvoteId}, callback_query) {
		const queryId = callback_query.id;
		const chat = this.bot.getChat(callback_query.message.chat.id);
		if(!chat.config.simvote) chat.config.simvote = [];

		const vote = chat.config.simvote.find(vote => vote.id === SimvoteId);
		const text = callback_query.message.text;

		if(!text || !vote) {
			await this.bot.fetch('answerCallbackQuery', {
				callback_query_id: queryId,
				text: '너무 오래된 메시지입니다!'
			});
			return;
		}

		const username = callback_query.from.username;

		if(!username) {
			await this.bot.fetch('answerCallbackQuery', {
				callback_query_id: queryId,
				text: '유저명이 없습니다!'
			});
		}

		const votedOpt = vote.options.filter(v => v.voters.includes(username));
		const votedAll = votedOpt.length >= vote.multivote;

		const votingOpt = vote.options[OptionId];
		if(!votingOpt) {
			await this.bot.fetch('answerCallbackQuery', {
				callback_query_id: queryId,
				text: '투표하려는 옵션이 사라졌습니다!'
			});
			return;
		}

		if(!votingOpt.voters.includes(username)) {
			if(votedAll) {
				await this.bot.fetch('answerCallbackQuery', {
					callback_query_id: queryId,
					text: '이미 전부 투표하셨습니다: ' + votedOpt.map(v => v.emoji).join(' ')
				});
				return;
			}

			votingOpt.voters.push(username);
		} else {
			votingOpt.voters = votingOpt.voters.filter(v => v !== username);
		}

		await chat.save();

		await this.bot.fetch('editMessageText', {
			chat_id: callback_query.message.chat.id,
			message_id: callback_query.message.message_id,
			text,
			reply_markup: CommandSimpleVote.getKeyboard(SimvoteId, vote.options, vote.anonymity)
		});

		await this.bot.fetch('answerCallbackQuery', {
			callback_query_id: queryId,
			text: '성공적으로 투표했습니다!'
		});
	}
}

export default CommandQuerySimpleVote;
