var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var schema = new Schema({
    categoryName: {type:String, required:true}
});

module.exports = mongoose.model('Category', schema);
