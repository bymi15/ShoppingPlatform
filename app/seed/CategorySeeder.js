var Category = require('../models/category');

var mongoose = require('mongoose');
mongoose.Promise = require('bluebird');

var env = process.env.NODE_ENV || 'development';
var config = require('../config')[env];

mongoose.connect(config.databaseURI);

var categories = [
    new Category({categoryName: 'Art'}),
    new Category({categoryName: 'Apps & Games'}),
    new Category({categoryName: 'Baby'}),
    new Category({categoryName: 'Books'}),
    new Category({categoryName: 'Beauty'}),
    new Category({categoryName: 'Cars & Motorbikes'}),
    new Category({categoryName: 'Clothing'}),
    new Category({categoryName: 'Cell Phones & Accessories'}),
    new Category({categoryName: 'Computers & Tablets'}),
    new Category({categoryName: 'DVDs & Movies'}),
    new Category({categoryName: 'Home & Garden'}),
    new Category({categoryName: 'Jewellery'}),
    new Category({categoryName: 'Sports & Outdoors'}),
    new Category({categoryName: 'Pet Supplies'}),
    new Category({categoryName: 'Toys & Dolls'})
];

var done = 0;
for (var i = 0; i < categories.length; i++) {
    categories[i].save(function(err, result) {
        done++;
        if (done === categories.length) {
            console.log("Categories have been successfully added!");
            exit();
        }
    });
}

function exit() {
    mongoose.disconnect();
}
