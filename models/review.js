var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');
var Schema = mongoose.Schema;

var schema = new Schema({
    product: {type: Schema.Types.ObjectId, ref: 'Product'},
    description: {type:String, required:true},
    rating: {type:Number, required:true},
    reviewBy: {type: Schema.Types.ObjectId, ref: 'User'}
},
{
    timestamps: true
});

schema.plugin(mongoosePaginate);

module.exports = mongoose.model('Review', schema);
