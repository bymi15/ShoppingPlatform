var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');
var Schema = mongoose.Schema;

var schema = new Schema({
    user: {type: Schema.Types.ObjectId, ref: 'User'},
    cart: {type: Object, required:true},
    sellers: [{type:Schema.ObjectId, ref:'User'}],
    paymentId: {type:String, required:false},
    shippingAddress: {type: Schema.Types.ObjectId, ref: 'ShippingAddress'}
},
{
    timestamps: true
});

schema.plugin(mongoosePaginate);

module.exports = mongoose.model('Order', schema);
