var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt-nodejs');

var schema = new Schema({
    fullName: {type:String, required:true},
    email: {type:String, required:true},
    password: {type:String, required:true}
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
