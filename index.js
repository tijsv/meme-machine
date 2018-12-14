require('dotenv').config()
const Discord = require('discord.js');
const client = new Discord.Client();
const mongoose = require('mongoose');
const axios = require('axios');

// Meme model
const Meme = require('./models/meme.js');
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

// Commands
const commands = [
	{ name: 'stream', description: `Get the link to ${streamer.name}\'s stream.` },
	{ name: 'ping', description: 'Play ping pong with me. If you dare to oppose me human.' },
	{ name: 'roll', description: 'Roll a dice. Test your luck.' },
	{ name: 'addmeme', description: `Add a meme to the server\'s meme list. (Usage: ${prefix}addmeme URL)` },
	{ name: 'randommeme', description: 'Show a random meme of the server\'s meme list.' },
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
			msg.channel.send(addMemeToDB(msg, args[1]));
			break;

		// Remove a meme from the Database
		case "removememe":
			let output = await removeMemeFromDB(args[1]);
			msg.channel.send(output);
			break;

		// Returns a random meme from the meme list
		case "randommeme":
			let output2 = await getRandomMemeFromDB();
			msg.channel.send(output2);
			break;

		// Return random coordinates of the Fortnite map
		case "randomdrop":
			msg.channel.send(getRandomLocation());
			break;
		
		// If the special character was used but the command is not recognised
		default:
			msg.channel.send(
				`This is not a valid command ${msg.author.username}, you foolish mortal.\nType ${prefix}help and you will get a list of all the commands I listen to.`
			);

	}

	// If -hide is used after command, the command message will be deleted
	if(args[args.length - 1] === "-hide") {
		deleteMessage(msg);
	}

});

function outputHelp(commands) {
	let output = "...\n\nBeep boop. This is a list of all possible commands:\n```";
	for(let i = 0; i < commands.length; i++) {
		output += `\t${prefix}${commands[i].name} : ${commands[i].description}\n`;
	}
	output += '```\nFeature ideas can be sent to my master, Tigroh.\n\n...';
	return output;
}

function deleteMessage(message) {
	console.log(`'${message.content}' was hidden by ${message.author.username}.`);
	return message.delete();
}

function addMemeToDB(message, url) {

	if(!isURLValid(url)) return "The URL you submitted is not valid.";

	const meme = new Meme({
		_id: mongoose.Types.ObjectId(),
		userID: message.author.id,
		URL: url,
		time: message.createdAt
	})
	
	meme.save()
	.then(result => {
		console.log(`${result.URL} was added to the database.`)
		return "Thank you for submitting. Your meme was added to the list.";
	})
	.catch(err => {
		console.log(err)
		return "Something went wrong saving this meme."
	});

}

async function removeMemeFromDB(index) {
	
	console.log('Removing a meme from the database...');

	return new Promise(function(resolve, reject) {

			Meme.findOne().skip(parseInt(index-1)).exec(async function (err, result) {

				if(err) {

					console.log(err)
					return reject("Deleting this meme didn't seem to work.");

				}

				Meme.findOneAndDelete({ _id: result._id }, function(err) {

					if(err) return console.log(err);

					resolve(`Meme ${index} perished. RIP :pray:`);

				})

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

				if(err) return console.log(err);

				let date = new Date(result.time);
				let dateString = `${date.getUTCDate()}-${date.getUTCMonth()+1}-${date.getUTCFullYear()}`
				let timeString = calculateTime(date).join(":");
				let user = await client.fetchUser(result.userID);
				let output = `\`Submitted by ${user.username} on ${dateString} at ${timeString} (index: ${random})\`\n${result.URL}`;

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

	console.log(`Checking if ${streamer.name} is live...`)

	let output;

	axios.get(`https://api.twitch.tv/kraken/streams/${streamer.username}`, { 
		headers: {
			'Client-ID': process.env.TWITCH_API_KEY
		}
	})
	.then(function(result) {
		result.data.stream ? output = "live" : output = "offline";
		console.log(`Axios response: ${output}`);
		return output;
	})
	.catch(function(error) {
		output = "error";
		console.log(`Axios response: ${output}`);
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