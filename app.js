const  express = require('express')

const app = express();
const bcrypt = require('bcryptjs')

const mongoose = require('mongoose');
const user = require('./models.js');
const passport = require('passport');
const session = require('express-session')
const cookieParser = require('cookie-parser')
const flash = require('connect-flash');

const multer = require('multer');
const path = require('path');

app.use(express.static(__dirname + '/public'));

app.use(express.urlencoded({extended: false}))


app.use(cookieParser('secret'));
app.use(session({
    secret: 'secret',
    maxAge: 3600000,
    resave: true,
    saveUninitialized: true,

}))



app.use(passport.initialize());
app.use(passport.session());

app.use(flash());

//global variables
app.use(function(req, res, next){
res.locals.success_message = req.flash('success_message');
res.locals.error_message = req.flash('error_message');
res.locals.error = req.flash('error');
next();
})

const checkAuthenticated = function(req, res, next){
    if(req.isAuthenticated()){
        res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
        next();
    }else{
        res.redirect('/login')
    }
}

mongoose.connect("mongodb://localhost:27017/userdb", {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    })
    .then(() => console.log('DB Connected!'))
    .catch(err => {
    console.log(err);
    });

app.set('view engine' , 'ejs')

app.get('/', (req, res) =>{
    Post.find(function (err, posts) {
    res.render('index',{ user: req.user ,posts: posts })
    });
})


app.get('/register', (req, res) =>{
    res.render('register')
  })

app.post('/register', (req, res) =>{
    var{ name, email, password, repassword} = req.body;
    let err;
    if(!email || !name || !password || !repassword){
        err="Please fill all the fields";
        res.render('register', {'err': err})
    }
    if(password!=repassword){
        err="Passwords Don't Match";
        res.render('register', {'err': err, 'name': name, 'email': email})
    }
    
    if(typeof err == 'undefined'){
        user.findOne({email: email}, function(err,data){
            if(err) throw err;
            if(data){
                console.log("user exists");
                err= "User already exists";
                res.render('register', {'err': err, 'name': name, 'email': email});
            }else{
                bcrypt.genSalt(10,(err,salt)=>{
                    if(err) throw err;
                    bcrypt.hash(password,salt, (err,hash) =>{
                        if(err) throw err;
                        password = hash;
                        user({
                            name,
                            email,
                            password
                        }).save((err,data)=>{
                            if(err) throw err;
                            //req.flash('success_message', 'Registered Successfully. Login to continue');
                            res.redirect('/login')
                        })

                    })
                })
            }
        })
    }
    // res.render('login')
  })


//authentication strategy
var localStrategy = require('passport-local').Strategy;
passport.use(new localStrategy ({usernameField: 'email'}, (email, password,done)=>{
user.findOne({email: email}, (err,data)=>{
    if(err) throw err;
    if(!data){
        return done(null,false,{message: "User Doesn't exist"});
    }
    bcrypt.compare(password, data.password, (err,match)=>{
        if(err){
            return done(null,false);
        }
        if(!match){
            return done(null,false,{message: "Password Doesn't match"});
        }
        if(match){
            return done (null,data);
        }
    })
})
}))

passport.serializeUser(function(user,cb){
    cb(null,user.id);
})

passport.deserializeUser(function(id,cb){
    user.findById(id, function(err,user){
        cb(err,user);
    })
})

//end of authentication strategy

app.get('/login', (req, res) =>{
res.render('login')
})

app.post('/login', (req, res, next) =>{
    passport.authenticate('local', {
        failureRedirect: '/login',
        successRedirect: '/success',
        failureFlash: true
    })(req, res, next);
})



app.get('/success', checkAuthenticated, (req, res) =>{
    res.render('success',{'user':req.user})
})

//uploading file in a post using multer

// const storage = multer.diskStorage({
//     destination: function(req, file, cb) {
//         cb(null, 'uploads/');
//     },

//     // By default, multer removes file extensions so let's add them back
//     filename: function(req, file, cb) {
//         cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
//     }
// });

// const maxSize = 1 * 1000 * 1000; 
// var upload = multer({  
//     storage: storage, 
//     limits: { fileSize: maxSize }, 
//     fileFilter: function (req, file, cb){ 
    
//         // Set the filetypes, it is optional 
//         var filetypes = /jpeg|jpg|png/; 
//         var mimetype = filetypes.test(file.mimetype); 
  
//         var extname = filetypes.test(path.extname( 
//                     file.originalname).toLowerCase()); 
        
//         if (mimetype && extname) { 
//             return cb(null, true); 
//         } 
      
//         cb("Error: File upload only supports the "
//                 + "following filetypes - " + filetypes); 
//       }  
  
// // mypic is the name of file attribute 
// }).single("mypic");   




//storage Engine for Multer
const storage = multer.diskStorage({
    destination: 'public/uploads/',
    filename: function(req,file,cb){
        cb(null,file.fieldname+'-'+Date.now()+path.extname(file.originalname));
    }
});

//Initialize upload variable
const upload = multer({
    storage: storage
}).single('myImage');


app.get('/addPost', checkAuthenticated, (req, res) =>{
    res.render('addPost', {user:req.user})
})

const postSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
        
    },
    postTitle: {
        type: String,
        required: true,
    },
    postContent: {
        type: String,
        required: true,
    },
    postImage: {
        type: String
    },    
    author: {
        type: String,
        required: true
    },
    postDate: {
        type: Date
    }
});

const Post = mongoose.model('Post', postSchema);

app.post('/addpost', upload, (req, res) => {
    console.log(req.file);
    var{ postTitle, postContent} = req.body;
    var postImage = req.file.filename;
    
    Post({
        user: req.user._id,
        postTitle,
        postContent,
        postImage,
        author: req.user.name,
        postDate: new Date()
    }).save().then( result => {
         req.flash('Post added');
         res.redirect('/dash')
    }).catch(err => {
        res.status(400).send("Unable to save data");
    });
    
});

    

app.get('/dash',checkAuthenticated,(req,res)=>{
    Post.find({}).sort({postDate: -1}).exec(function (err, posts) {
        res.render('dash',{ user: req.user ,posts: posts })
        });
})

app.get('/profile',checkAuthenticated, (req,res)=>{
    Post.find({'author': req.user.name}).sort({postDate: -1}).exec(function (err, posts) {
        if(err)
        console.log(err);
        res.render('profile',{ user: req.user ,posts: posts })
        });
})


app.get("/userProfile/:id", checkAuthenticated,function(req,res){
    console.log(req.params.id);
    Post.find({user: req.params.id}).sort({postDate: -1}).exec(function (err, posts) {
        if(err)
        console.log(err);
    
       if (posts){
           user.findOne({_id:req.params.id}).exec(function(err,record){
               if(err)
               console.log(err);
               console.log(record);
               
               res.render('userProfile', {user: req.user, mangal: record, posts: posts})
           })
       }
        });
})

app.get('/postOpen/:id',checkAuthenticated,(req,res)=>{
    console.log(req.params.id);
    Post.find({_id:req.params.id}).exec(function (err, posts) {
        if(err)
        console.log(err);
        console.log('Data is:'+posts);
        res.render('postOpen',{user: req.user, posts: posts })
        });
})

app.get('/signout',checkAuthenticated, (req,res)=>{
    res.render('signout',{user:req.user})
})
app.get('/logout', (req,res)=>{
    req.logout();
    res.redirect('/');
})

app.listen(3000, ()=> console.log("server started")
)