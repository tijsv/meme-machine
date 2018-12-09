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
	{ name: 'addmeme', description: 'Add a meme to the server\'s meme list.' },
	{ name: 'randommeme', description: 'Show a random meme of the server\'s meme list.' },
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

		if(!streamerIsLive && streamerStatus === "live") {
			mainChannel.send(`${streamer.name} is now live! Watch here:\n${streamer.link}`);
			streamerIsLive = true;

		} else if(streamerIsLive && streamerStatus === "offline") {
			streamerIsLive = false;
		}

	}, 120000);

});

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

		// Returns a random meme from the meme list
		case "randommeme":
			let output = await getRandomMemeFromDB();
			msg.channel.send(output);
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
				let output = `\`Submitted by ${user.username} on ${dateString} at ${timeString}\`\n${result.URL}`;

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

	return new Promise(function(resolve, reject) {

		axios.get(`https://api.twitch.tv/kraken/streams/${streamer.username}`, { 
			headers: {
				'Client-ID': process.env.TWITCH_API_KEY
			}
		})
		.then(function(result) {
			result.data.stream ? resolve("live") : resolve("offline");
		})
		.catch(function(error) {
			reject("error");
			console.log(error);
		});

	});

}

client.login(process.env.BOT_LOGIN);