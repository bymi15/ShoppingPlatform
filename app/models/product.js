var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');
var Schema = mongoose.Schema;

var schema = new Schema({
    title: {type:String, required:true},
    description: {type:String, required:false},
    imagePath: {type:String, required:true},
    photos: {type:[String], required:false},
    seller: {type: Schema.Types.ObjectId, ref: 'User'},
    category: {type: Schema.Types.ObjectId, ref: 'Category'},
    attributes: {type: Schema.Types.Mixed, required:false},
    stock: {type:Number, required:true},
    views: {type:Number, default: 0},
    price: {type:Number, required:true},
    ratingSum: {type:Number, default: 0},
    ratingCount: {type:Number, default: 0}
},
{
    timestamps: true
});

schema.index({ title: 'text', description: 'text' });

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

module.exports = mongoose.model('Product', schema);
