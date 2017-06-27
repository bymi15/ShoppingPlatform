var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');
var Schema = mongoose.Schema;

var schema = new Schema({
    user: {type: Schema.Types.ObjectId, ref: 'User'},
    cart: {type: Object, required:true},
    paymentId: {type:String, required:true},
    shippingAddress: {type: Schema.Types.ObjectId, ref: 'ShippingAddress'}
},
{
    timestamps: true
});

schema.methods.hasLowStock = function(){
    return (this.stock <= 5 && this.stock >= 1);
};

schema.methods.outOfStock = function(){
    return this.stock <= 0;
};

schema.methods.hasStock = function(quantity){
    return this.stock >= quantity;
};

schema.plugin(mongoosePaginate);

module.exports = mongoose.model('Order', schema);
