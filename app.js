const Joi = require('joi');
const express = require('express');
const bodyParser = require('body-parser')
const multer = require('multer');
const path = require('path');

const userRoute = require('./routes/user')
const sequelize = require('./util/database');
const feedRoutes = require('./routes/feed');
const authRoutes = require('./routes/auth');
const Address = require('./models/address');
const Post = require('./models/post');
const PostContent = require('./models/postContent');
const PostRate = require('./models/postRate');
const Image = require('./models/image');
const Product = require('./models/product');
const User = require('./models/user');
const Cart = require('./models/cart');
const CartItem = require('./models/cart-item');
const Order = require('./models/order');
const OrderItem = require('./models/order-item');

const app = express();
const port = process.env.PORT || 8080;

const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'images');
    },
    filename: (req, file, cb) => {
        cb(null, new Date().toISOString() + '-' + file.originalname);
    }
});

const fileFilter = (req, file, cb) => {
    if (
        file.mimetype === 'image/png' ||
        file.mimetype === 'image/jpg' ||
        file.mimetype === 'image/jpeg'
    ) {
        cb(null, true);
    } else {
        cb(null, false);
    }
};

//Enables Parse json on the body of request
app.use(bodyParser.json());
app.use(
    multer({
        storage: fileStorage,
        fileFilter: fileFilter
    }).single('image')
);
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
        'Access-Control-Allow-Methods',
        'OPTIONS, GET, POST, PUT, PATCH, DELETE'
    );
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

app.use('/feed', feedRoutes);
app.use('/auth', authRoutes);
app.use('/user', userRoute);
app.use((error, req, res, next) => {
    console.log(error);
    const status = error.statusCode || 500;
    const message = error.message;
    const data = error.data;
    res.status(status).json({
        message: message,
        data: data
    });
});
app.use((req, res, next) => {
    res.status(404).send('<h1>not found</h1>')
})

// Man.hasOne(RightArm);
// RightArm.belongsTo(Man);

//Address.belongsTo(User, { constraints: true, onDelete: 'CASCADE' });
User.hasMany(Address);
Post.belongsTo(User, {
    onDelete: 'CASCADE'
});
//User.hasMany(Post); //One-to-many

PostRate.belongsTo(Post, {
    constraints: true,
    onDelete: 'CASCADE'
})
Post.hasMany(PostRate)
PostRate.belongsTo(User, {
    constraints: true,
    onDelete: 'CASCADE'
})
Post.hasMany(PostContent)
PostContent.hasMany(Image)

Cart.belongsTo(User, {
    constraints: true,
    onDelete: 'CASCADE'
});
User.hasOne(Cart);
Cart.belongsToMany(Product, {
    through: CartItem
});
Product.belongsToMany(Cart, {
    through: CartItem
});
Order.belongsTo(User, {
    constraints: true,
    onDelete: 'CASCADE'
});
User.hasMany(Order);
Order.belongsToMany(Product, {
    through: OrderItem
});



sequelize
    // .sync({
    //     force: true
    // })
    .sync()
    // .then(result => {
    //     return User.findAll();
    //     // console.log(result);
    // })
    // .then(user => {
    //     console.log(user[0]);

    //     if (!user[0]) {
    //         return User.create({
    //             firstname: 'Max',
    //             email: 'test@test.com'
    //         });
    //     }
    //     return user;
    // })
    .then(cart => {
        app.listen(port, console.log(`Listening on port ${port}`));
    })
    .catch(err => {
        console.log(err);
    });