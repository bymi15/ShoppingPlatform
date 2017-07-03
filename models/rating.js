var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var schema = new Schema({
    product: {type: Schema.Types.ObjectId, ref: 'Product'},
    sum: {type:Number, default: 0},
    count: {type:Number, default: 0}
},
{
    timestamps: true
});

schema.methods.hasLowStock = function(){
    return (this.stock <= 5 && this.stock >= 1);
};

module.exports = mongoose.model('Rating', schema);
