var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var schema = new Schema({
    sum: {type:Number, default: 0},
    count: {type:Number, default: 0},
    users: {type: Schema.Types.Mixed, required:false},
},
{
    timestamps: true
});

schema.methods.hasLowStock = function(){
    return (this.stock <= 5 && this.stock >= 1);
};

module.exports = mongoose.model('Rating', schema);
