var passport = require('passport');
var User = require('../models/user');
var LocalStrategy = require('passport-local').Strategy;

passport.serializeUser(function(user, done){
    done(null, user.id);
});

passport.deserializeUser(function(id, done){
    User.findById(id, function(err, user){
        done(err, user);
    });
});

passport.use('local.register', new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true
}, function(req, email, password, done){
    req.checkBody('fullName', 'Please enter a valid name').notEmpty().isLength({min:4});
    req.checkBody('email', 'Please enter a valid email address').notEmpty().isEmail();
    req.checkBody('password', 'Please enter a valid password').notEmpty().isLength({min:6});
    var errors = req.validationErrors();
    if(errors){
        var messages = [];
        errors.forEach(function(error){
            messages.push(error.msg);
        });
        return done(null, false, req.flash('error', messages));
    }
    /*check whether email already exists*/
    User.findOne({'email': email}, function(err, user){
        if(err){
            return done(err);
        }
        if(user){
            return done(null, false, {message: 'Email already exists'});
        }
        var newUser = new User();
        newUser.fullName = req.body.fullName;
        newUser.email = email;
        newUser.password = newUser.passwordHash(password);
        newUser.save(function(err, result){
            if(err){
                return done(err);
            }
            return done(null, newUser);
        });
    });
}));

passport.use('local.login', new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true
}, function(req, email, password, done){
    User.findOne({'email': email}, function(err, user){
        if(err){
            return done(err);
        }
        if(!user || !user.passwordValid(password)){
            return done(null, false, {message: 'Invalid login details'});
        }

        return done(null, user);
    });
}));


