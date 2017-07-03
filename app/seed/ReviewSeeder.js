var Review = require('../models/review');
var User = require('../models/user');
var Product = require('../models/product');
var async = require("async");

var mongoose = require('mongoose');
mongoose.Promise = require('bluebird');

var env = process.env.NODE_ENV || 'development';
var config = require('../config')[env];

mongoose.connect(config.databaseURI);

async.parallel({
    userA: function(callback) {
        User.findOne({email: 'bymi15@yahoo.com'}, function(err, user){
            if(err){
                return callback(err);
            }
            return callback(null, user);
        });
    },
    userB: function(callback) {
        User.findOne({email: 'jack@gmail.com'}, function(err, user){
            if(err){
                return callback(err);
            }
            return callback(null, user);
        });
    },
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

    var reviews = [
        new Review({product: results.productA,
                    description: 'Great product!',
                    rating: 4,
                    reviewBy: results.userA}),
        new Review({product: results.productB,
                    description: 'Awesome product! Worked perfectly as expected.',
                    rating: 5,
                    reviewBy: results.userA}),
        new Review({product: results.productA,
                    description: 'Terrible quality. Was not expecting this! I am very disappointed.',
                    rating: 1,
                    reviewBy: results.userB})
    ];

    var done = 0;
    for (var i = 0; i < reviews.length; i++) {
        reviews[i].save(function(err, result) {
            done++;
            if (done === reviews.length) {
                console.log("Reviews have been successfully added!");
                exit();
            }
        });
    }
});

function exit() {
    mongoose.disconnect();
}
