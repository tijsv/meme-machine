require('dotenv').config()
const Discord = require('discord.js');
const client = new Discord.Client();
const mongoose = require('mongoose');
const axios = require('axios');

// Meme model
const Meme = require('./models/meme.js');
// quoteUser model
const QuotesUser = require('./models/quotes.js');

// Database connection
mongoose.connect(`mongodb://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_NAME}`, { 
	useNewUrlParser: true,
}).then(result => console.log("Connected to the database."))
.catch(err => console.log("Something went wrong when connecting to the database."));

// Bot settings
const prefix = ">";
const streamer = {
	name: 'Glitch',
	username: 'Glitch_it',
	link: 'https://www.twitch.tv/glitch_it'
}
const admins = ["320708435798654986", "226065793371209730"];

// Commands
const commands = [
	{ name: 'stream', description: `Get the link to ${streamer.name}\'s stream.` },
	{ name: 'ping', description: 'Play ping pong with me. If you dare to oppose me human.' },
	{ name: 'roll', description: 'Roll a dice. Test your luck.' },
	{ name: 'addmeme', description: `Add a meme to the server\'s meme list. (Usage: ${prefix}addmeme URL)` },
	{ name: 'removememe', description: `Remove a meme from the server\'s meme list. (Usage: ${prefix}removememe ID)` },
	{ name: 'randommeme', description: 'Show a random meme of the server\'s meme list.' },
	{ name: 'addquote', description: `Add a quote to your list of quotes. (Usage: ${prefix}addquote TYPE QUOTE HERE)` },
	{ name: 'randomquote', description: 'Show a random quote of the server\'s quotes lists.' },
	{ name: 'randomdrop', description: 'Show random coordinates to land on in Fornite.' },
];

// On start of the bot
client.on('ready', () => {

	const testingChannel = client.guilds.get('473563325066641428').channels.get('519942427709145090');
	const mainChannel = client.guilds.get('473563325066641428').channels.get('473563325066641430');
	var streamerIsLive = false;

	// Startup messages
	console.log(`Logged in as ${client.user.tag}!`);
	testingChannel.send("Beep boop. Meme Machine at your service.");

	// Interval that checks every 2 minutes if Glitch's stream is live
	setInterval(async () => {

		let streamerStatus = await getStreamerStatus(streamer);

		if(streamerStatus === "live" && !streamerIsLive) {
			mainChannel.send(`${streamer.name} is now live! Watch here:\n${streamer.link}`);
			streamerIsLive = true;

		} else if(streamerStatus === "offline" && streamerIsLive) {
			streamerIsLive = false;

		} else if(streamerStatus === "error") {
			console.log('Something went wrong getting data from twitch API.');
		}

	}, 300000);

});

// Catching unexpected errors
client.on('error', console.error);

// On message sent in the server
client.on('message', async msg => {

	// If not a command, return
	if(msg.content[0] !== prefix) return;

	// Get the command of the user
	let args = msg.content.substr(1).split(" ");
	let command = args[0].toLowerCase();
	let output = "";

	// If -hide is used after command, the command message will be deleted
	let hidden = false;
	if(args[args.length - 1] === "-hide") {
		hidden = true;
		args.splice(args.length - 1, 1);
	}

	// Switch statement with all possible commands
	switch(command) {

		// Returns all commands with a description
		case "help":
			msg.channel.send(outputHelp(commands));
			break;
		
		// Ping pong
		case "ping":
			msg.channel.send('Pong!');
			break;

		// Roll a dice
		case "roll":
			msg.channel.send(`You rolled ${Math.floor(Math.random() * 6) + 1}!`);
			break;

		// Returns a link to Glitch's stream
		case "stream":
			msg.channel.send(`Watch ${streamer.name}\'s stream here: ${streamer.link}`);
			break;

		// Add a meme to the Database
		case "addmeme":
			output = await addMemeToDB(msg, args[1]);
			msg.channel.send(output);
			break;

		// Remove a meme from the Database
		case "removememe":
			output = await removeMemeFromDB(args[1], msg.author.id);
			msg.channel.send(output);
			break;

		// Returns a random meme from the meme list
		case "randommeme":
			output = await getRandomMemeFromDB();
			msg.channel.send(output);
			break;

		// Return random coordinates of the Fortnite map
		case "randomdrop":
			msg.channel.send(getRandomLocation());
			break;

		// Add a random quote to the quote list
		case "addquote":
			output = await addQuoteToDB(msg, args);
			msg.channel.send(output);
			break;

		// Return a random quote from the database
		case "randomquote":
			output = await getRandomQuoteFromDB();
			msg.channel.send(output);
			break;
		
		// If the special character was used but the command is not recognised
		default:
			msg.channel.send(
				`This is not a valid command ${msg.author.username}, you foolish mortal.\nType ${prefix}help and you will get a list of all the commands I listen to.`
			);

	}

	if(hidden) deleteMessage(msg);

});

function outputHelp(commands) {
	let output = "...\n\nBeep boop. This is a list of all possible commands:\n```";
	for(let i = 0; i < commands.length; i++) {
		output += `\t${prefix}${commands[i].name} : ${commands[i].description}\n`;
	}
	output += '```\nQuestionable quote/meme entries will get deleted. Continuously adding offensive/inapropriate entries will result in a ban.\nFeature ideas can be sent to my master, Tigroh.\n\n...';
	return output;
}

function deleteMessage(message) {
	console.log(`'${message.content}' was hidden by ${message.author.username}.`);
	return message.delete();
}

async function addQuoteToDB(message, args) {

	return new Promise(function(resolve, reject) {

		const userID = message.author.id;
		args.splice(0, 1);

		const quote = {
			_id: mongoose.Types.ObjectId(),
			content: args.join(" "),
			time: message.createdAt
		}

		QuotesUser.findOne({ userID: userID })
		.then(async (result) => {

			let quotesUser;
			if(!result) {
				quotesUser = await createNewQuotesUser(userID);
				if(!quotesUser.quotes) reject("Something went wrong creating a new quotesUser.");
			} else {
				quotesUser = result;
			}

			quotesUser.quotes.push(quote);
			quotesUser.save()
			.then(result => {
				console.log(`Quote '${quote.content}' was added tot the database by ${message.author.username}.`);
				resolve("This quote was added to the database.");
			})
			.catch(err => {
				console.log('Something went wrong while saving the new quote.\n', err);
				reject("This quote could not be added to the database.");
			});

		})
		.catch(err => {
			console.log('Something went wrong while searching for a quotesUser.\n', err);
			reject("This quote could not be added to the database.");
		});

	});

}

async function createNewQuotesUser(userID) {

	console.log('Creating a new quotesUser...');

	return new Promise(function(resolve, reject) {
		
		const quotesUser = new QuotesUser({
			userID: userID,
			quotes: []
		})
	
		quotesUser.save()
		.then(result => {
			resolve(quotesUser);
		})
		.catch(err => {
			console.log("createNewQuotesUser error: ", err);
			reject({});
		});

	})

}

async function addMemeToDB(message, url) {

	if(!isURLValid(url)) return "The URL you submitted is not valid.";

	return new Promise(function(resolve, reject) {
		
		const meme = new Meme({
			_id: mongoose.Types.ObjectId(),
			userID: message.author.id,
			URL: url,
			time: message.createdAt
		})
		
		meme.save()
		.then(result => {
			console.log(`${result.URL} was added to the database.`)
			resolve(`Thank you for submitting. Your meme was added to the list. (id: ${meme._id})`);
		})
		.catch(err => {
			console.log(err)
			reject("Something went wrong while saving this meme."); 
		});

	});

}

async function removeMemeFromDB(id, userID) {

	if(!admins.includes(userID)) {
		console.log(`User ${userID} tried to remove a meme without admin rights.`)
		return "You don't have admin rights. You shall not pass.";  
	}

	console.log('Removing a meme from the database...');

	return new Promise(function(resolve, reject) {

		Meme.findOneAndDelete({ _id: id }, function(err) {

			if(err) {
				console.log(err);
				reject(`Something went wrong removing this element from the database.`);
			}

			resolve(`Meme ${id} perished. RIP :pray:`);

		})

	});

}

async function getRandomMemeFromDB() {

	console.log('Getting a random meme from the database...');

	return new Promise(function(resolve, reject) {

		// CountDocument is an Async function, so you need to wait for the callback function to execute
		Meme.countDocuments({}, function(err, count) {

			if(err) return console.log(err);

			const random = Math.floor(Math.random() * count);
			Meme.findOne().skip(random).exec(async function (err, result) {

				if(err) {
					console.log(err);
					reject("Something went wrong while getting a random meme from the database.");
				}

				let date = new Date(result.time);
				let dateString = `${date.getUTCDate()}-${date.getUTCMonth()+1}-${date.getUTCFullYear()}`
				let timeString = calculateTime(date).join(":");
				let user = await client.fetchUser(result.userID);
				let output = `${result.URL}\n\`Submitted by ${user.username} on ${dateString} at ${timeString} (id: ${result._id})\``;

				resolve(output);

			})

		});

	});

}

async function getRandomQuoteFromDB() {
	console.log('Getting a random quote from the database...');

	return new Promise(function(resolve, reject) {

		// CountDocument is an Async function, so you need to wait for the callback function to execute
		QuotesUser.countDocuments({}, function(err, count) {

			if(err) return console.log(err);

			const randomQuotesUserIndex = Math.floor(Math.random() * count);
			QuotesUser.findOne().skip(randomQuotesUserIndex).exec(async function (err, result) {

				if(err) {
					console.log(err);
					reject("Something went wrong while getting a random quote from the database.");
				}

				const randomQuoteIndex =  Math.floor(Math.random() * result.quotes.length);

				const randomQuote = result.quotes[randomQuoteIndex];

				let date = new Date(randomQuote.time);
				let dateString = `${date.getUTCDate()}-${date.getUTCMonth()+1}-${date.getUTCFullYear()}`
				let timeString = calculateTime(date).join(":");
				let user = await client.fetchUser(result.userID);
				let output = `${randomQuote.content}\n\`Submitted by ${user.username} on ${dateString} at ${timeString} (id: ${randomQuote._id})\``;

				resolve(output);

			})

		});

	});
}

function calculateTime(date) {
	let timeArray = [date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()];
	for(let i = 0; i < timeArray.length; i++) {
		timeArray[i] < 10 ? timeArray[i] = "0" + timeArray[i].toString() : timeArray[i].toString(); 
	}
	return timeArray;	
}

function isURLValid(str) {
	var pattern = new RegExp('^(https?:\\/\\/)' +
	'((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|' +
	'((\\d{1,3}\\.){3}\\d{1,3}))' +
	'(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' +
	'(\\?[;&a-z\\d%_.~+=-]*)?' +
	'(\\#[-a-z\\d_]*)?$','i');
	return pattern.test(str);
}

async function getStreamerStatus(streamer) {

	let output;

	axios.get(`https://api.twitch.tv/kraken/streams/${streamer.username}`, { 
		headers: {
			'Client-ID': process.env.TWITCH_API_KEY
		}
	})
	.then(function(result) {
		result.data.stream ? output = "live" : output = "offline";
		return output;
	})
	.catch(function(error) {
		output = "error";
		return output;
	})
	
}

function getRandomLocation() {
	let letterArray = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
	let randomLetter = Math.floor(Math.random() * 10);
	let randomNumber = Math.floor(Math.random() * 10 + 1);
	return `You have to land on ${letterArray[randomLetter] + randomNumber}. Good luck.`;
}

client.login(process.env.BOT_LOGIN);