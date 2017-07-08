var Product = require('../models/product');
var User = require('../models/user');
var Category = require('../models/category');
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
    catA: function(callback) {
        Category.findOne({categoryName: 'Computers & Tablets'}, function(err, cat){
            if(err){
                return callback(err);
            }
            return callback(null, cat);
        });
    },
    catB: function(callback) {
        Category.findOne({categoryName: 'Cell Phones & Accessories'}, function(err, cat){
            if(err){
                return callback(err);
            }
            return callback(null, cat);
        });
    }
}, function(err, results) {
    if (err) return console.log(err);

    var products = [
        new Product({
            imagePath: 'https://upload.wikimedia.org/wikipedia/commons/a/af/WMCH_Drone.jpg',
            title: 'DJI Phantom 4 Quadcopter Drone',
            description: 'Auto takeoff and auto return home with GPS technology, makes controlling easy. App enables monitoring/camera operation easy\nCapture 4K ultra HD video at 30 fps, supported resolutions include: 12.0MP (4000 x 3000) photos. The f/2.8 lens with a broad field of view delivers crisp, clear images\nGimbal stabilization technology, along with a hover function allows you to capture smooth, clean footage while the camera is in the air\nUse DJI director software with a built-in video editor to add music, text, and more to your videos.\nPlease Note: Kindly refer the User Manual before use.',
            price: 850,
            stock: 1,
            seller: results.userA,
            category: results.catB
        })
    ];

    var done = 0;
    for (var i = 0; i < products.length; i++) {
        products[i].save(function(err, result) {
            done++;
            if (done === products.length) {
                console.log("Products have been successfully added!");
                exit();
            }
        });
    }
});

function exit() {
    mongoose.disconnect();
}
