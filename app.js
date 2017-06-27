var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var expressHbs = require('express-handlebars');
var mongoose = require('mongoose');
mongoose.Promise = require('bluebird');
var session = require('express-session');
var passport = require('passport');
var flash = require('connect-flash');
var validator = require('express-validator');
var MongoStore = require('connect-mongo')(session);

var index = require('./routes/index');
var userRoutes = require('./routes/user');

var Category = require('./models/category');

var app = express();

mongoose.connect('mongodb://ds139122.mlab.com:39122/heroku_wjmqlnqn');

require('./config/passport');

// view engine setup
//app.set('views', path.join(__dirname, 'views'));
app.engine('.hbs', expressHbs({defaultLayout: 'layout', extname: '.hbs'}));
app.set('view engine', '.hbs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(validator());
app.use(cookieParser());
app.use(session({
    secret: 'super@secret',
    resave: false,
    saveUninitialized: false,
    store: new MongoStore({ mongooseConnection: mongoose.connection }),
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));

app.use(function(req, res, next){
    res.locals.loggedIn = req.isAuthenticated();
    res.locals.session = req.session;
    res.locals.user = req.user;
    res.locals.success_message = req.flash('success_message');
    res.locals.error_message = req.flash('error_message');

    if(req.url=='/'){
      res.locals.isHomePage = true;
    }

    Category.find({}, function(err, categories){
      if(err){
        next(err);
      }

      res.locals.categories = req.session.categories = categories;
      next();
    });
});

// routes
app.use('/user', userRoutes);
app.use('/', index);

app.use('/slider-pro', express.static(__dirname + '/node_modules/slider-pro/dist/'));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
