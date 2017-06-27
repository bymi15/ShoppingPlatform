var express = require('express');
var router = express.Router();
var Cart = require('../models/cart');
var flash = require('connect-flash');
var async = require('async');
var path = require('path');
var fs = require('fs');
var mongoose = require('mongoose');

var Product = require('../models/product');
var Category = require('../models/category');
var Order = require('../models/order');
var ShippingAddress = require('../models/shippingAddress');

const uuidV4 = require('uuid/v4');

var multer = require('multer');
var upload = multer({ dest: 'public/images/uploads/' });


router.get('/addToCart/:id', function(req, res, next) {
    var productId = req.params.id;
    var cart = new Cart(req.session.cart ? req.session.cart : {items: {}, totalQuantity: 0, totalPrice: 0});

    Product.findById(productId, function(err, product){
        if(err){
            req.flash("error_message", "An error has occured! Please try again.");
            res.redirect('back');
        }

        //if item exists in cart
        if(cart.items[product.id]){
            var quantity = cart.items[product.id].quantity + 1;
            if(!product.hasStock(quantity)){
                req.flash("error_message", "Sorry! The item you selected is out of stock.");
                return res.redirect('/shop');
            }
        }

        cart.add(product, product.id);
        req.session.cart = cart;
        req.flash("success_message", "'" + product.title + "' was successfully added to your cart!");
        res.redirect('back');
    });
});

router.get('/cart', function(req, res, next) {
    if(!req.session.cart){
        return res.render('shop/cart', {products: null});
    }

    var cart = new Cart(req.session.cart);
    var products = cart.generateArray();

    for(var i = 0; i < products.length; i++){
        var quantityArr = [];
        for(var n = 1; n <= products[i].item.stock; n++){
            quantityArr.push(n);
            if(n>=6){
                break;
            }
        }

        products[i].stockAvailable = quantityArr;

        if(parseInt(products[i].item.stock) > 9){
            products[i].hasHighStock = true;
        }
    }

    res.render('shop/cart', {products: products, totalPrice: cart.totalPrice});
});

router.post('/updateCart/:id', function(req, res, next) {
    var productId = req.params.id;
    var quantity = req.body.productQuantity;

    if(quantity < 1){
        req.flash("error_message", "An error has occured! Please try again.");
        return res.redirect('back');
    }

    var cart = new Cart(req.session.cart ? req.session.cart : {});

    Product.findById(productId, function(err, product){
        if(err){
            req.flash("error_message", "An error has occured! Please try again.");
            return res.redirect('back');
        }

        if(!product.hasStock(quantity)){
            req.flash("error_message", "Sorry! '" + product.title + "' has insufficient stock.");
            return res.redirect('back');
        }

        cart.updateQuantity(productId, quantity);
        req.session.cart = cart;
        req.flash("success_message", "Successfully updated your cart!");
        res.redirect('/cart');
    });
});

router.get('/removeFromCart/:id', function(req, res, next) {
    var productId = req.params.id;
    var cart = new Cart(req.session.cart ? req.session.cart : {});

    cart.removeItem(productId);
    req.session.cart = cart;
    req.flash("success_message", "Successfully removed product from cart");
    res.redirect('/cart');
});

router.get('/checkout', isLoggedIn, function(req, res, next) {
    if(!req.session.cart){
        return res.redirect('/cart');
    }

    var cart = new Cart(req.session.cart);

    var cartArr = cart.generateArray();
    var productsOutOfStock = [];
    async.forEachOf(cartArr, function(cartItem, key, callback){
        var productId = cartItem.item._id;
        var quantity = cartItem.quantity;

        Product.findById(productId, function(err, product){
            if(err || !product){
                return callback(err);
            }

            if(!product.hasStock(quantity)){
                productsOutOfStock.push(product);
            }

            callback();
        });
    }, function(err){
        //all async tasks completed
        if(err){
            req.flash("error_message", "An error has occured! Please try again.");
            return res.redirect('/checkout');
        }

        if(productsOutOfStock.length >= 1){
            var msg = "Sorry! ";
            for(var i = 0; i < productsOutOfStock.length; i++){
                msg = msg + " '" + productsOutOfStock[i].title + "'";
            }
            msg = msg + " have insufficient stock."
            req.flash("error_message", msg);
            return res.redirect('/cart');
        }else{
            ShippingAddress.findOne({user: req.user}, function(err, shipping){
                if(err){
                    req.flash("error_message", "An error has occured! Please try again.");
                    return res.redirect('/checkout');
                }

                if(shipping){
                    res.render('shop/checkout', {cart: cart, address1: shipping.address1, address2: shipping.address2, city: shipping.city, postalCode: shipping.postalCode});
                }else{
                    res.render('shop/checkout', {cart: cart});
                }
            });
        }
    });
});

router.post('/checkout', isLoggedIn, function(req, res, next) {
    if(!req.session.cart){
        return res.redirect('/cart');
    }

    var cart = new Cart(req.session.cart);
    var stripe = require("stripe")(
      "sk_test_9zHUItnUCbHQWtbcejrNLnT1"
    );

    stripe.charges.create({
      amount: cart.totalPrice * 100,
      currency: "usd",
      source: req.body.stripeToken, // obtained with Stripe.js
      description: "Test charge"
    }, function(err, charge) {
        if(err){
            req.flash("error_message", err.message);
            return res.redirect('/checkout');
        }

        //update stock quantity of the products purchased
        var cartArr = cart.generateArray();

        async.forEachOf(cartArr, function(cartItem, key, callback){
            var productId = cartItem.item._id;
            var quantity = cartItem.quantity;

            Product.findById(productId, function(err, product){
                if(err || !product){
                    return callback(err);
                }

                product.stock -= quantity;

                product.save(function(err, result){
                    if(err){
                        return callback(err);
                    }
                    callback();
                });
            });

        }, function(err){
            //all async tasks completed
            if(err){
                req.flash("error_message", "An error has occured! Please try again.");
                return res.redirect('/checkout');
            }

            //create or update shipping address details
            ShippingAddress.findOneAndUpdate({user: req.user},
                {
                  $set: {
                    user: req.user,
                    address1: req.body.address1,
                    address2: req.body.address2,
                    city: req.body.city,
                    postalCode: req.body.postalCode
                  }
                },
                {upsert: true, new: true},
                function(err, shipping) {
                    if(err){
                        req.flash("error_message", "An error has occured! Please try again.");
                        return res.redirect('/checkout');
                    }

                    //add the order to the database
                    var order = new Order({
                        user: req.user,
                        cart: cart,
                        paymentId: charge.id,
                        shippingAddress: shipping
                    });

                    order.save(function(err, result){
                        if(err){
                            req.flash("error_message", "An error has occured! Please try again.");
                            return res.redirect('/checkout');
                        }
                        req.session.cart = null;
                        res.render('shop/orderSummary', {shipping: shipping, products: cart.items, total: cart.totalPrice});
                    });
                }
            );
        });
    });
});

router.post('/editShippingAddress', isLoggedIn, function(req, res, next) {
    //create or update shipping address details
    ShippingAddress.findOneAndUpdate({user: req.user},
        {
            $set: {
                user: req.user,
                address1: req.body.address1,
                address2: req.body.address2,
                city: req.body.city,
                postalCode: req.body.postalCode
                  }
        },
        {upsert: true, new: true},
        function(err, shipping) {
            if(err){
                req.flash("error_message", "An error has occured! Please try again.");
                return res.redirect('back');
            }

            req.flash("success_message", "Success! Your shipping address has been updated.");
            res.redirect('back');

        }
    );
});

router.get('/sell', isLoggedIn, function(req, res, next) {
    res.render('shop/sell', {});
});

router.post('/sell', isLoggedIn, upload.single('imageUpload'), function(req, res, next) {
    var product = new Product();
    product.title = req.body.title;
    product.description = req.body.description;
    product.category = mongoose.Types.ObjectId(req.body.category);
    product.price = req.body.price;
    product.seller = req.user;
    product.stock = req.body.stock;

    var allowedExtensions = ['.png', '.jpg', '.jpeg', '.bmp', '.gif'];
    var ext = path.extname(req.file.originalname).toLowerCase();

    var tempPath = req.file.path;
    var newFileName = uuidV4() + ext;
    var targetPath = path.resolve('./public/images/uploads/' + newFileName);

    product.imagePath = '/images/uploads/' + newFileName;

    if (allowedExtensions.indexOf(ext) > -1) {
        fs.rename(tempPath, targetPath, function(err) {
            if(err){
                req.flash("error_message", "An error has occured! Please try again.");
                return res.redirect('/sell');
            }

            product.save(function(err, result){
                if(err){
                    req.flash("error_message", "An error has occured! Please try again.");
                    return res.redirect('/sell');
                }
                req.flash("success_message", "Successfully added product for sale!");
                res.redirect('/shop');
            });
        });
    } else {
        fs.unlink(tempPath, function () {
            req.flash("error_message", "An error has occured! Please make sure you selected a valid image.");
            return res.redirect('back');
        });
    }
});


router.get('/product/:id', function(req, res, next) {
    var productId = req.params.id;

    if(!req.session.viewed){
        req.session.viewed = [];
    }
    var viewed = false;
    for(var i = 0; i < req.session.viewed.length; i++){
        if(req.session.viewed[i].id == productId){
            viewed = true;
            break;
        }
    }

    if(!viewed){
        Product.findById(productId).populate(['seller', 'category']).exec(function(err, product){

            product.views = product.views + 1;

            product.save(function(err, result){
                if(err){
                    req.flash("error_message", "An error has occured! Please try again.");
                    res.redirect('back');
                }

                req.session.viewed.push({id: productId});

                if(result){
                    if(result.hasLowStock()){
                        return res.render('shop/product', { product: result, hasLowStock: true });
                    }else if(result.outOfStock()){
                        return res.render('shop/product', { product: result, outOfStock: true });
                    }else{
                        return res.render('shop/product', { product: result, inStock: true });
                    }
                }

                res.redirect('back');
            });
        });
    }else{
        Product.findById(productId).populate(['seller', 'category']).exec(function(err, product){

            if(product){
                if(product.hasLowStock()){
                    return res.render('shop/product', { product: product, hasLowStock: true });
                }else if(product.outOfStock()){
                    return res.render('shop/product', { product: product, outOfStock: true });
                }else{
                    return res.render('shop/product', { product: product, inStock: true });
                }
            }

            res.redirect('back');
        });
    }
});

router.get('/removeProduct/:id', isLoggedIn, function(req, res, next) {
    var productId = req.params.id;

    Product.findById(productId, function(err, product){
        if(err || !product){
            req.flash("error_message", "An error has occured! Please try again.");
            return res.redirect('back');
        }

        if(!req.user.equals(product.seller)){
            req.flash("error_message", "Error! You do not have permission.");
            return res.redirect('back');
        }

        var imagePath = path.resolve('./public' + product.imagePath);

        product.remove(function(err, removed){
            if(err || !removed){
                req.flash("error_message", "An error has occured! Please try again.");
                return res.redirect('back');
            }

            //remove thumbnail image
            fs.unlink(imagePath, function () {
                req.flash("success_message", "Successfully removed product!");
                res.redirect('back');
            });
        });
    });
});

router.get('/adjustStock/:id/:stock', isLoggedIn, function(req, res, next) {
    var productId = req.params.id;
    var stock = req.params.stock;

    Product.findById(productId, function(err, product){
        if(err || !product){
            req.flash("error_message", "An error has occured! Please try again.");
            return res.redirect('back');
        }

        if(!req.user.equals(product.seller)){
            req.flash("error_message", "Error! You do not have permission.");
            res.redirect('back');
        }

        product.stock = stock;

        product.save(function(err, result){
            if(err){
                req.flash("error_message", "An error has occured! Please try again.");
                return res.redirect('back');
            }
            req.flash("success_message", "Successfully adjusted stock!");
            res.redirect('back');
        });

    });
});

router.get('/search/:pageNum', function(req, res, next) {
    var searchString = req.query.q;
    var category = req.query.cat;

    var pageNum = req.params.pageNum;
    var pages = [];
    var noProducts = false;

    if(category){
        var foundCategory = null;
        for(var key in req.session.categories){
            if(category === req.session.categories[key].categoryName){
                foundCategory = req.session.categories[key];
                break;
            }
        }

        if(foundCategory){
            Product.paginate({ $text : { $search : searchString }, category: foundCategory }, { sort: { createdAt: -1, _id: -1}, page: pageNum, limit: 12, populate: ['seller', 'category'] }, function(err, result) {
                if(err){
                    req.flash("error_message", "An error has occured! Please try again.");
                    res.redirect('back');
                }
                var totalPages = Math.ceil(result.total / 12);
                noProducts = (totalPages==0);
                for(var i = 1; i <= totalPages; i++){
                    if(i==pageNum){
                        pages.push({num: i, current: true});
                    }else{
                        pages.push({num: i, current: false});
                    }
                }
                var escapedCategoryName = encodeURIComponent(foundCategory.categoryName);
                escapedCategoryName = escapedCategoryName.replace(/%20/g, "+");

                res.render('shop/search', { products: result.docs, pages: pages, searchString: searchString, categoryName: foundCategory.categoryName, escapedCategoryName: escapedCategoryName, noProducts: noProducts, currentPage: pageNum, numProducts: result.total });
            });
        }else{
            req.flash("error_message", "An error has occured! Please try again.");
            res.redirect('back');
        }
    }else{
        Product.paginate({ $text : { $search : searchString } }, { sort: { createdAt: -1, _id: -1}, page: pageNum, limit: 12, populate: ['seller', 'category'] }, function(err, result) {
            if(err){
                req.flash("error_message", "An error has occured! Please try again.");
            res.redirect('back');
            }
            var totalPages = Math.ceil(result.total / 12);
            noProducts = (totalPages==0);
            for(var i = 1; i <= totalPages; i++){
                if(i==pageNum){
                    pages.push({num: i, current: true});
                }else{
                    pages.push({num: i, current: false});
                }
            }
            res.render('shop/search', { products: result.docs, pages: pages, searchString: searchString, noProducts: noProducts, currentPage: pageNum, numProducts: result.total });
        });
    }
});

router.get('/category/:id', function(req, res, next) {
    var categoryId = mongoose.Types.ObjectId(req.params.id);
    var categoryName = null;
    for(var key in req.session.categories){
        var cat = req.session.categories[key];
        if(cat._id == req.params.id){
            categoryName = req.session.categories[key].categoryName;
            break;
        }
    }

    var pages = [];
    pages.push({num: 1, current: true});
    Product.paginate({category: categoryId}, { sort:{ createdAt: -1, _id: -1}, page: 1, limit: 12, populate: ['seller', 'category'] }, function(err, result) {
        if(err){
            req.flash("error_message", "An error has occured! Please try again.");
            res.redirect('back');
        }
        var totalPages = Math.ceil(result.total / 12);
        for(var i = 2; i <= totalPages; i++){
            pages.push({num: i, current: false})
        }
        res.render('shop/index', { products: result.docs, pages: pages, categoryName: categoryName, categoryId: categoryId, currentPage: 1, numProducts: result.total});
    });
});

router.get('/category/:id/:pageNum', function(req, res, next) {
    var categoryId = mongoose.Types.ObjectId(req.params.id);
    var categoryName = null;
    for(var key in req.session.categories){
        var cat = req.session.categories[key];
        if(cat._id == req.params.id){
            categoryName = req.session.categories[key].categoryName;
            break;
        }
    }

    var pageNum = req.params.pageNum;
    var pages = [];
    Product.paginate({category: categoryId}, { sort:{ createdAt: -1, _id: -1}, page: pageNum, limit: 12, populate: ['seller', 'category'] }, function(err, result) {
        if(err){
            req.flash("error_message", "An error has occured! Please try again.");
            res.redirect('back');
        }
        var totalPages = Math.ceil(result.total / 12);
        for(var i = 1; i <= totalPages; i++){
            if(i==pageNum){
                pages.push({num: i, current: true});
            }else{
                pages.push({num: i, current: false});
            }
        }
        res.render('shop/index', { products: result.docs, pages: pages, categoryName: categoryName, categoryId: categoryId, currentPage: pageNum, numProducts: result.total});
    });
});

router.get('/shop/:pageNum', function(req, res) {
    var pageNum = req.params.pageNum;
    var pages = [];
    Product.paginate({}, { sort:{ createdAt: -1, _id: -1}, page: pageNum, limit: 12, populate: ['seller', 'category'] }, function(err, result) {
        if(err){
            req.flash("error_message", "An error has occured! Please try again.");
            res.redirect('back');
        }
        var totalPages = Math.ceil(result.total / 12);
        for(var i = 1; i <= totalPages; i++){
            if(i==pageNum){
                pages.push({num: i, current: true});
            }else{
                pages.push({num: i, current: false});
            }
        }
        res.render('shop/index', { products: result.docs, pages: pages, currentPage: pageNum, numProducts: result.total});
    });
});

router.get('/shop', function(req, res, next) {
    var pages = [];
    pages.push({num: 1, current: true});
    Product.paginate({}, { sort:{ createdAt: -1, _id: -1}, page: 1, limit: 12, populate: ['seller', 'category'] }, function(err, result) {
        if(err){
            req.flash("error_message", "An error has occured! Please try again.");
            res.redirect('back');
        }
        var totalPages = Math.ceil(result.total / 12);
        for(var i = 2; i <= totalPages; i++){
            pages.push({num: i, current: false})
        }
        res.render('shop/index', { products: result.docs, pages: pages, currentPage: 1, numProducts: result.total});
    });
});

router.get('/', function(req, res, next) {
    //finding popular products
    Product.find({}).sort({ views: -1 }).limit(6).populate('seller').exec(function(err, products){
        if(err){
            req.flash("error_message", "An error has occured! Please try again.");
            res.redirect('back');
        }

        res.render('main', { products: products });
    });
});
module.exports = router;

function isLoggedIn(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
    req.session.oldUrl = req.url;
    req.flash("error_message", "Please login to proceed");
    res.redirect('/user/login');
}



