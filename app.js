require("dotenv").config(); 
const express = require("express");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");
const _ = require('lodash');

const homeStartingContent = "Welcome to your personal online journal! Here's some of your latest posts.";
const aboutContent = "This is your personal daily journal. Why waste books when you can access your journals online anytime securely?";
const contactContent = "Email: arkar@gmail.com";

const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({extended: true}));
app.use(express.static("public"));

app.use(session({
  secret: "Just some random long text for the session.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

let port = process.env.PORT;
if(port == null || port == ""){
  port = 3000;
}

//Database setup
const mongoUsername = process.env.MONGO_USERNAME;
const mongoPasswd = process.env.MONGO_PASSWD;
const uri = 'mongodb+srv://' + mongoUsername + ':' + mongoPasswd + '@cluster0.zr80h.mongodb.net/journalDB'
mongoose.connect(uri, {useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false});
mongoose.set("useCreateIndex", true);

//Set two schemas: post and user collections
const postSchema = new mongoose.Schema({
  title: {
      type: String,
      required: true
  },
  content: {
      type: String,
      required: true
  },
})
const Post = mongoose.model("Post", postSchema);

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  posts: [postSchema]
})

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

//For authentication
passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,   
  clientSecret: process.env.CLIENT_SECRET,  
  callbackURL: "http://localhost:3000/auth/google/dailyjournal",  
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
function(accessToken, refreshToken, profile, cb) {
  User.findOrCreate({ username: profile.emails[0].value , googleId: profile.id }, function (err, user) {
    return cb(err, user);
  });
}
));
////////////////////////////////////////////End of project set up////////////////////////////////////////////////////

app.get("/", function(req, res){
  res.render("start");
});

app.get("/login", function(req, res){
  res.render("login");
});

app.get("/register", function(req, res){
  res.render("register");
});

app.get("/home", function(req, res){
  if(req.isAuthenticated()){
    User.findById(req.user.id, function(err, foundUser){
      if(err){
        console.log(err);
      }else{
        if(foundUser){
          res.render('home', {homeStartingContent: homeStartingContent, posts: req.user.posts});
        }
      }
    });
  }else{
    res.redirect("/");
  }
});

app.get("/about", function(req, res){
  res.render("about", {aboutContent: aboutContent});
});

app.get("/contact", function(req, res){
  res.render("contact", {contactContent: contactContent});
});

app.get("/seeall", function(req, res){
  if(req.isAuthenticated()){
    res.render("seeall", {posts: req.user.posts});
}else{
    res.redirect("/");
}
});

app.get("/compose", function(req, res){
  if(req.isAuthenticated()){
    res.render("compose");
}else{
    res.redirect("/");
}
});

app.post("/compose", function(req, res){
  const post = new Post({
    title: req.body.titleText,
    content: req.body.contentText,
  });
  post.save();

  User.findById(req.user.id, function(err, foundUser){
    foundUser.posts.push(post);
    foundUser.save();
    res.redirect("/home");
  });
});

app.post("/delete", function(req, res){
  const deletePostId = req.body.deleted;

      User.findOneAndUpdate({_id: req.user._id}, {$pull: {posts: {_id: deletePostId}}}, function(err){
          if(err){
              console.log(err);
          }else{
              res.redirect("/seeall");
          }
      });
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/dailyjournal', 
  passport.authenticate('google', { failureRedirect: '/' }),
  function(req, res) {
  // Successful authentication, redirect home.
  res.redirect('/home');
});

app.post("/register", function(req, res){
    User.register({username: req.body.username,  active: false}, req.body.password, function(err, user){
        if(err){
            console.log(err);
            res.redirect("/register");
        }else{
            passport.authenticate("local")(req, res, function(){
            res.redirect("/home");
            });
        }
    });
});

app.post("/login", function(req, res){
    
  const user = new User({
      username: req.body.username,
      password: req.body.password
  });

  req.login(user, function(err){
      if(err){
          console.log(err);
      }else{
          passport.authenticate("local")(req, res, function(){
              res.redirect("/home");
          });
      }
});
});

app.get("/logout", function(req, res){
  req.logout();
  res.redirect("/");
});

app.get("/posts/:postid", function(req, res){
  const requestedId = req.params.postid;

  Post.findOne({_id: requestedId}, function(err, post){
    if(err){
      console.log(err);
    }else{
      res.render("post", {post: post});
    }
  });
});

app.listen(port, function() {
  console.log("Server has started.");
});
