var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt-nodejs');

var schema = new Schema({
    fullName: {type:String, required:true},
    email: {type:String, required:true},
    password: {type:String, required:true},
    //used for purchasing
    stripeCustomerId: {type:String, required:false},
    stripeCardId: {type:String, required:false}, //card details
    stripeCardBrand: {type:String, required:false}, //card details
    stripeCardLastFour: {type:String, required:false}, //card details
    //used for receiving payment
    stripeUserId: {type:String, required:false},
    stripeAccessToken: {type:String, required:false},
    stripeRefreshToken: {type:String, required:false}
},
{
    timestamps: true
});

schema.methods.passwordHash = function(password){
    return bcrypt.hashSync(password, bcrypt.genSaltSync(5), null);
};

schema.methods.passwordValid = function(password){
    return bcrypt.compareSync(password, this.password);
}

module.exports = mongoose.model('User', schema);
