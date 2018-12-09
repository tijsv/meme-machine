const mongoose = require('mongoose');

const memeSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    userID: String,
    URL: String,
    time: Date
})

module.exports = mongoose.model("Meme", memeSchema);