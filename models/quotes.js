const mongoose = require('mongoose');

const quotesSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    userID: String,
    content: String, 
    time: Date          
})

module.exports = mongoose.model("quotes", quotesSchema);