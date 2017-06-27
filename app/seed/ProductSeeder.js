var Product = require('../models/product');
var User = require('../models/user');
var Category = require('../models/category');
var async = require("async");

var mongoose = require('mongoose');
mongoose.Promise = require('bluebird');

mongoose.connect('localhost:27017/shoppingplatform');

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
            imagePath: 'https://static.bhphoto.com/images/images500x500/apple_mp2j2ll_a_ipad_wi_fi_128gb_9_7_1490127824000_1327830.jpg',
            title: 'Apple 9.7" iPad (2017, 128GB, Wi-Fi Only, Silver)',
            description: 'Compatible with 5.2K Gimbal Cameras\nCineCore 2.0 Image Processing\nSupports CinemaDNG and ProRes Recording',
            price: 120,
            stock: 10,
            seller: results.userA,
            category: results.catA
        }),
        new Product({
            imagePath: 'https://www.bhphotovideo.com/images/images2500x2500/gopro_chdhx_501_hero5_black_1274419.jpg',
            title: 'GoPro HERO5 Black',
            description: 'Dual-Battery Design\nAccelerates to 50 mph in 4 Seconds\n58 mph Maximum Velocity\nAdvanced Obstacle Sensing',
            price: 350,
            stock: 50,
            seller: results.userB,
            category: results.catB
        }),
        new Product({
            imagePath: 'https://static.bhphoto.com/images/images500x500/1475081721000_1285006.jpg',
            title: 'Dell XPS 8910 Desktop Computer',
            description: 'Compatible with 5.2K Gimbal Cameras\nCineCore 2.0 Image Processing\nSupports CinemaDNG and ProRes Recording',
            price: 500,
            stock: 20,
            seller: results.userA,
            category: results.catA
        }),
        new Product({
            imagePath: 'https://static.bhphoto.com/images/images500x500/dji_inspire_2_quadcopter_1479242108000_1298562.jpg',
            title: 'DJI Inspire 2 Quadcopter',
            description: 'Compatible with 5.2K Gimbal Cameras\nCineCore 2.0 Image Processing\nSupports CinemaDNG and ProRes Recording\nAccelerates to 50 mph in 4 Seconds\n58 mph Maximum Velocity\nAdvanced Obstacle Sensing\n2-Axis Stabilized FPV Camera',
            price: 1200,
            stock: 5,
            seller: results.userA,
            category: results.catB
        }),
        new Product({
            imagePath: 'https://static.bhphoto.com/images/images500x500/samsung_sa_g950u_a001_gege_galaxy_s8_64gb_smartphone_1496762512000_1337323.jpg',
            title: 'Samsung Galaxy S8 SM-G950U 64GB Smartphone',
            description: 'GSM + CDMA / 4G LTE Capable\nNorth American Variant\nf/1.7 12MP Rear + 8MP Front Cameras\nOcta-Core Snapdragon 835 Chipset\n64GB Storage Capacity and 4GB of RAM\nmicroSD Memory Card Slot\n5.8" AMOLED Infinity Display\nQuad HD+ 2960 x 1440 Native Resolution\nIP68 Waterproof to 4.9\nAndroid 7.0 Nougat',
            price: 600,
            stock: 100,
            seller: results.userB,
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
