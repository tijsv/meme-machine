const mongoose = require('mongoose');

const quotesUserSchema = mongoose.Schema({
    userID: String,
    quotes: [{
        _id: mongoose.Schema.Types.ObjectId,
        content: String, 
        time: Date
    }],
})

module.exports = mongoose.model("quotesUser", quotesUserSchema);