var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var schema = new Schema({
    user: {type: Schema.Types.ObjectId, ref: 'User'},
    address1: {type:String, required:true},
    address2: {type:String, required:false},
    city: {type:String, required:true},
    postalCode: {type:String, required:true}
});

module.exports = mongoose.model('ShippingAddress', schema);
