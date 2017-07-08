var express = require('express');
var router = express.Router();
var Cart = require('../models/cart');
var flash = require('connect-flash');
var async = require('async');
var path = require('path');
var fs = require('fs');
var qs = require('qs');
var request = require('request');
var mongoose = require('mongoose');

var Product = require('../models/product');
var Category = require('../models/category');
var Order = require('../models/order');
var Review = require('../models/review');
var ShippingAddress = require('../models/shippingAddress');

const uuidV4 = require('uuid/v4');

var multer = require('multer');
var upload = multer({ dest: 'public/images/uploads/' });

var env = process.env.NODE_ENV || 'development';
var config = require('../config')[env];

var CLIENT_ID = config.stripe_client_id;
var CLIENT_SECRET = config.stripe_client_secret;

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

router.get("/stripe/connect", isLoggedIn, function(req, res, next) {
    // Redirect to Stripe /oauth/authorize endpoint
    res.redirect("https://connect.stripe.com/oauth/authorize?" + qs.stringify({
        response_type: "code",
        scope: "read_write",
        client_id: CLIENT_ID
    }));
});

router.get("/stripe/disconnect", isLoggedIn, function(req, res, next) {
    // Make /oauth/token endpoint POST request
    request.post({
        url: 'https://connect.stripe.com/oauth/deauthorize',
        form: {
          stripe_user_id: req.user.stripeUserId,
          client_secret: CLIENT_SECRET,
          client_id: CLIENT_ID
        }
    }, function(err, r, body) {
        if(err || JSON.parse(body).error){
            req.flash("error_message", "An error has occured! Please try again.");
            return res.redirect('/user/profile');
        }

        var currentUser = req.user;
        currentUser.stripeCardId = null;
        currentUser.stripeCardBrand = null;
        currentUser.stripeCardLastFour = null;
        currentUser.stripeUserId = null;
        currentUser.stripeRefreshToken = null;
        currentUser.stripeAccessToken = null;

        currentUser.save(function(err, result){
            if(err){
                req.flash("error_message", "An error has occured! Please try again.");
                return res.redirect('/user/profile');
            }

            req.flash("success_message", "Your account has been successfully disconnected from Stripe.");
            return res.redirect('/user/profile');
        });
    });
});

router.get('/stripe/callback', isLoggedIn, function(req, res, next) {
    var authCode = req.query.code;
    var err = req.query.error;
    if(err){
        req.flash("error_message", "An error has occured! Please try again.");
        return res.redirect('/user/profile');
    }

    // Make /oauth/token endpoint POST request
    request.post({
        url: 'https://connect.stripe.com/oauth/token',
        form: {
          grant_type: "authorization_code",
          client_id: CLIENT_ID,
          code: authCode,
          client_secret: CLIENT_SECRET
        }
    }, function(err, r, body) {
        if(err){
            req.flash("error_message", "An error has occured! Please try again.");
            return res.redirect('/user/profile');
        }

        var bodyObj = JSON.parse(body);

        var currentUser = req.user;
        currentUser.stripeUserId = bodyObj.stripe_user_id;
        currentUser.stripeRefreshToken = bodyObj.refresh_token;
        currentUser.stripeAccessToken =bodyObj.access_token;

        currentUser.save(function(err, result){
            if(err){
                req.flash("error_message", "An error has occured! Please try again.");
                return res.redirect('/user/profile');
            }

            req.flash("success_message", "Success! Your account has been connected with Stripe.");
            res.redirect('/user/profile');
        });
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

    var hasExistingCard = false;
    if(req.user.stripeCustomerId){
        hasExistingCard = true;
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
                    res.render('shop/checkout', {cart: cart, address1: shipping.address1, address2: shipping.address2, city: shipping.city, postalCode: shipping.postalCode, hasExistingCard: hasExistingCard});
                }else{
                    res.render('shop/checkout', {cart: cart, hasExistingCard: hasExistingCard});
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
    var stripe = require("stripe")(CLIENT_SECRET);

    var newPayment = (req.body.radioPayment == "useNewPayment");

    async.parallel({
        createStripeCustomer: function(callback) {
            var currentUser = req.user;
            if(!currentUser.stripeCustomerId || newPayment){
                // Create a Stripe customer:
                stripe.customers.create({
                    email: currentUser.email
                }).then(function(customer) {
                    if(newPayment && currentUser.stripeCardId){
                        stripe.customers.deleteCard(
                            currentUser.stripeCustomerId,
                            currentUser.stripeCardId,
                            function(err, confirmation) {
                                if(err){
                                    return callback(err);
                                }

                                stripe.customers.createSource(customer.id,
                                  { source:  req.body.stripeToken }, function(err, card) {
                                    if(err){
                                        return callback(err);
                                    }

                                    currentUser.stripeCustomerId = customer.id;
                                    currentUser.stripeCardId = card.id;
                                    currentUser.stripeCardBrand = card.brand;
                                    currentUser.stripeCardLastFour = card.last4;

                                    return currentUser.save(function(err, result){
                                        if(err){
                                            return callback(err);
                                        }

                                        return callback(null, result);
                                    });
                                });
                            }
                        );
                    }else{
                        stripe.customers.createSource(customer.id,
                          { source:  req.body.stripeToken }, function(err, card) {
                            if(err){
                                return callback(err);
                            }

                            currentUser.stripeCustomerId = customer.id;
                            currentUser.stripeCardId = card.id;
                            currentUser.stripeCardBrand = card.brand;
                            currentUser.stripeCardLastFour = card.last4;

                            return currentUser.save(function(err, result){
                                if(err){
                                    return callback(err);
                                }

                                return callback(null, result);
                            });
                        });
                    }
                });
            }else{
                return callback();
            }

        }
    }, function(err, results) {
        if(err){
            req.flash("error_message", "An error has occured! Please try again.");
            return res.redirect('/checkout');
        }

        var cartArr = cart.groupBySeller();

        async.forEachOf(cartArr, function(items, key, callback){
            var seller = items[0].item.seller;
            var totalPrice = 0;

            async.forEachOf(items, function(cartItem, key, callback){
                var productId = cartItem.item._id;
                var quantity = cartItem.quantity;
                totalPrice = totalPrice + (quantity * cartItem.item.price);

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
                if(err){
                    req.flash("error_message", "An error has occured! Please try again.");
                    return res.redirect('/checkout');
                }

                stripe.charges.create({
                    amount: totalPrice * 100,
                    currency: "usd",
                    customer: req.user.stripeCustomerId,
                    destination: seller.stripeUserId,
                    transfer_group: seller.id,
                }).then(function(charge) {
                    if(err){
                        req.flash("error_message", err.message);
                        return res.redirect('/checkout');
                    }

                    callback();
                });

            });

        }, function(err){
            if(err){
                req.flash("error_message", err.message);
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
                        shippingAddress: shipping
                    });

                    order.save(function(err, result){
                        if(err){
                            req.flash("error_message", "An error has occured! Please try again.");
                            return res.redirect('/checkout');
                        }
                        req.session.cart = null;
                        return res.render('shop/orderSummary', {shipping: shipping, products: cart.items, total: cart.totalPrice});
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

router.get('/writeReview/:id', isLoggedIn, function(req, res, next) {
    var productId = req.params.id;
    Product.findById(productId, function(err, product){
        if(err){
            req.flash("error_message", "An error has occured! Please try again.");
            return res.redirect('back');
        }

        res.render('shop/writeReview', {product: product});
    });
});

router.post('/writeReview/:id', isLoggedIn, function(req, res, next) {
    var productId = req.params.id;

    Product.findById(productId, function(err, product){
        if(err){
            req.flash("error_message", "An error has occured! Please try again.");
            return res.redirect('back');
        }

        var review = new Review();
        review.rating = req.body.ratingValue;
        review.description = req.body.description;
        review.reviewBy = req.user;
        review.product = product;

        review.save(function(err, result){
            if(err){
                req.flash("error_message", "An error has occured! Please try again.");
                return res.redirect('back');
            }

            product.ratingSum = product.ratingSum + parseInt(req.body.ratingValue);
            product.ratingCount = product.ratingCount + 1;

            product.save(function(err, result){
                if(err){
                    req.flash("error_message", "An error has occured! Please try again.");
                    return res.redirect('/checkout');
                }

                req.flash("success_message", "Success! Thank you for submitting a review.");
                res.redirect('/product/' + productId);
            });
        });
    });
});

router.get('/sell', isLoggedIn, function(req, res, next) {
    if(req.user.stripeUserId){
        return res.render('shop/sell', {});
    }

    req.flash("error_message", "Please connect your account with Stripe in order to start selling!");
    return res.redirect('/user/profile');
});

router.post('/sell', isLoggedIn, upload.array('imageUpload'), function(req, res, next) {
    var product = new Product();
    product.title = req.body.title;
    product.description = req.body.description;
    product.category = mongoose.Types.ObjectId(req.body.category);
    product.price = req.body.price;
    product.seller = req.user;
    product.stock = req.body.stock;
    var allowedExtensions = ['.png', '.jpg', '.jpeg', '.bmp', '.gif'];

    var thumbnailIndex = parseInt(req.body.thumbnailIndex);

    async.forEachOf(req.files, function(file, key, callback){
        var ext = path.extname(file.originalname).toLowerCase();

        var tempPath = file.path;
        var newFileName = uuidV4() + ext;
        var targetPath = path.resolve('./public/images/uploads/' + newFileName);

        if(key === thumbnailIndex){
            product.imagePath = '/images/uploads/' + newFileName;
        }

        product.photos[key] = ('/images/uploads/' + newFileName);

        if (allowedExtensions.indexOf(ext) > -1) {
            fs.rename(tempPath, targetPath, function(err) {
                if(err){
                    return callback("An error has occured! Please try again.");
                }
                callback();
            });
        } else {
            fs.unlink(tempPath, function () {
                return callback("An error has occured! Please make sure you selected a valid image.");
            });
        }

    }, function(err){
        //all async tasks completed
        if(err){
            req.flash("error_message", err);
            return res.redirect('back');
        }
        product.markModified('photos');
        product.save(function(err, result){
            if(err){
                req.flash("error_message", "An error has occured! Please try again.");
                return res.redirect('/sell');
            }
            req.flash("success_message", "Successfully added product for sale!");
            res.redirect('/product/' + result.id);
        });

    });
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
                    //retrieve product reviews
                    Review.find({product: product}).populate(['reviewBy']).exec(function(err, reviews){
                        if(err){
                            req.flash("error_message", "An error has occured! Please try again.");
                            res.redirect('back');
                        }

                        for(var i = 0; i < reviews.length; i++){
                            var date = new Date(reviews[i].createdAt);
                            reviews[i].date = date.toDateString();
                        }

                        var averageRating = 0;
                        var numRating = 0;

                        if(result.ratingCount >= 1){
                            averageRating = (result.ratingSum / result.ratingCount).toFixed(1);
                            numRating = result.ratingCount;
                        }

                        if(result.hasLowStock()){
                            return res.render('shop/product', { product: result, hasLowStock: true, reviews: reviews, averageRating: averageRating, numRating: numRating });
                        }else if(result.outOfStock()){
                            return res.render('shop/product', { product: result, outOfStock: true, reviews: reviews, averageRating: averageRating, numRating: numRating });
                        }else{
                            return res.render('shop/product', { product: result, inStock: true, reviews: reviews, averageRating: averageRating, numRating: numRating });
                        }
                    });
                }else{
                    req.flash("error_message", "An error has occured! Please try again.");
                    res.redirect('back');
                }
            });
        });
    }else{
        Product.findById(productId).populate(['seller', 'category']).exec(function(err, product){

            if(product){
                //retrieve product reviews
                Review.find({product: product}).populate(['reviewBy']).exec(function(err, reviews){
                    if(err){
                        req.flash("error_message", "An error has occured! Please try again.");
                        res.redirect('back');
                    }

                    for(var i = 0; i < reviews.length; i++){
                        var date = new Date(reviews[i].createdAt);
                        reviews[i].date = date.toDateString();
                    }

                    var averageRating = 0;
                    var numRating = 0;

                    if(product.ratingCount >= 1){
                        averageRating = (product.ratingSum / product.ratingCount).toFixed(1);
                        numRating = product.ratingCount;
                    }

                    if(product.hasLowStock()){
                        return res.render('shop/product', { product: product, hasLowStock: true, reviews: reviews, averageRating: averageRating, numRating: numRating });
                    }else if(product.outOfStock()){
                        return res.render('shop/product', { product: product, outOfStock: true, reviews: reviews, averageRating: averageRating, numRating: numRating });
                    }else{
                        return res.render('shop/product', { product: product, inStock: true, reviews: reviews, averageRating: averageRating, numRating: numRating });
                    }
                });
            }else{
                req.flash("error_message", "An error has occured! Please try again.");
                res.redirect('back');
            }
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

        var imagePaths = product.photos;

        product.remove(function(err, removed){
            if(err || !removed){
                req.flash("error_message", "An error has occured! Please try again.");
                return res.redirect('back');
            }

            async.forEachOf(imagePaths, function(imagePath, key, callback){
                var absPath = path.resolve('./public' + imagePath);
                fs.unlink(absPath, function () {
                    return callback();
                });
            }, function(err){
                //all async tasks completed
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

        var products = result.docs;
        for(var i = 0; i < products.length; i++){
            if(products[i].ratingCount >= 1){
                products[i].averageRating = (products[i].ratingSum / products[i].ratingCount).toFixed(1);
            }else{
                products[i].averageRating = 0;
            }
        }

        res.render('shop/index', { products: products, pages: pages, currentPage: pageNum, numProducts: result.total});
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

        var products = result.docs;
        for(var i = 0; i < products.length; i++){
            if(products[i].ratingCount >= 1){
                products[i].averageRating = (products[i].ratingSum / products[i].ratingCount).toFixed(1);
            }else{
                products[i].averageRating = 0;
            }
        }
        res.render('shop/index', { products: products, pages: pages, currentPage: 1, numProducts: result.total});
    });
});

router.get('/', function(req, res, next) {
    //finding popular products
    Product.find({}).sort({ views: -1 }).limit(6).populate('seller').exec(function(err, products){
        if(err){
            req.flash("error_message", "An error has occured! Please try again.");
            res.redirect('back');
        }

        for(var i = 0; i < products.length; i++){
            if(products[i].ratingCount >= 1){
                products[i].averageRating = (products[i].ratingSum / products[i].ratingCount).toFixed(1);
            }else{
                products[i].averageRating = 0;
            }
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



