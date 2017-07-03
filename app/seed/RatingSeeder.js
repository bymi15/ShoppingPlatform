var Product = require('../models/product');
var async = require("async");

var mongoose = require('mongoose');
mongoose.Promise = require('bluebird');

var env = process.env.NODE_ENV || 'development';
var config = require('../config')[env];

mongoose.connect(config.databaseURI);

async.parallel({
    productA: function(callback) {
        Product.findById('59485b8ec37c502d0c1e60b1', function(err, product){
            if(err){
                return callback(err);
            }
            return callback(null, product);
        });
    },
    productB: function(callback) {
        Product.findById('59485b9725af883e0c210328', function(err, product){
            if(err){
                return callback(err);
            }
            return callback(null, product);
        });
    }
}, function(err, results) {
    if (err) return console.log(err);

    results.productA.ratingSum = 5;
    results.productA.ratingCount = 2;
    results.productB.ratingSum = 5;
    results.productB.ratingCount = 1;

    var products = [results.productA, results.productB];

    var done = 0;
    for (var i = 0; i < products.length; i++) {
        products[i].save(function(err, result) {
            done++;
            if (done === products.length) {
                console.log("Ratings have been successfully added to the products!");
                exit();
            }
        });
    }
});

function exit() {
    mongoose.disconnect();
}
