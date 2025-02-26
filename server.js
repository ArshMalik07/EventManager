const express = require('express');// importing Express framework
const mongoose = require('mongoose');// for MongoDB connection
const bodyParser = require('body-parser');// Middleware for reading form data of HTTP requests
const dotenv = require('dotenv');// for environment variables in .env files
const bcrypt = require('bcrypt');// for password hashing
const session = require('express-session');// for session management on server side
const nodemailer = require('nodemailer');// Node JS library for sending emails
const multer = require('multer');//Middleware for uploading files, images, etc. at server side
const path = require('path');// for working with file and directory paths
const { hostname } = require('os');// for getting the hostname of the server


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); 
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname); 
  },
});

const upload = multer({ storage: storage });


dotenv.config();

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'frontend/public')); 



const port = process.env.PORT || 2000;
const dbURI = process.env.MONGO_URI; 
console.log('MongoDB URI:', dbURI); // Log the MongoDB URI to check if it's loaded correctly

const sessionSecret = process.env.SESSION_SECRET || 'arshmalek1109';
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/styles', express.static(path.join(__dirname, 'frontend/src/styles')));

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' ? true : false },
  })
);


mongoose
  .connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((error) => console.error('MongoDB connection error:', error));


const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  resetPin: String,
  resetPinExpiry: Date,
});

const User = mongoose.model('User', UserSchema);

const EventSchema = new mongoose.Schema({
  hostname: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, required: true },
  
  location: { type: String, required: true },
  capacity: { type: Number, default: 0, required: true },
  category: { type: String, required: true },
  image: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], 
});


const Event = mongoose.model('Event', EventSchema);


const NotificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  type: { type: String, required: true },  
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false }, 
  createdAt: { type: Date, default: Date.now },
});

const Notification = mongoose.model('Notification', NotificationSchema);

const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: emailUser,
    pass: emailPass,
  },
});

const validatePasswordStrength = (password) => {
  const regex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
  return regex.test(password);
};


//Register Routes.
app.get('/register', (req, res) => {
  res.sendFile(__dirname + '/frontend/public/register.html');
});

app.post('/register', async (req, res) => {
  try {
    const { name, email, username, password } = req.body;

    if (!name || !email || !username || !password) {
      return res.status(400).send('All fields are required.');
    }

  
    if (!validatePasswordStrength(password)) {
      return res.status(400).send('Password is too weak.');
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).send('Email or Username already registered.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, username, password: hashedPassword });
    await newUser.save();

    res.status(201).send('User registered successfully!');
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).send('An error occurred while registering the user.');
  }
});

//Login routes.
app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/frontend/public/login.html');
});

app.post('/login', async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    if (!(emailOrUsername) || !password) {
      return res.status(400).send('Email/Username and Password are required.');
    }

    const user = await User.findOne({ $or: [{ email: emailOrUsername }, { username: emailOrUsername }] });
    if (!user) {
      return res.status(401).send('Invalid credentials.');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).send('Invalid credentials.');
    }

    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
    };

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).send('An error occurred while logging in.');
  }
});


app.get('/forgotpassword', (req, res) => {
  res.sendFile(__dirname + '/frontend/public/forgotpassword.html');
});

app.post('/forgotpassword', async (req, res) => {
  try {
    const { emailOrUsername } = req.body;

    if (!emailOrUsername) {
      return res.status(400).send('Email or Username is required.');
    }

    const user = await User.findOne({ $or: [{ email: emailOrUsername }, { username: emailOrUsername }] });
    if (!user) {
      return res.status(404).send('User not found.');
    }

    const resetPin = Math.floor(100000 + Math.random() * 900000).toString();
    req.session.resetPin = resetPin; // Set the resetPin in the session

    user.resetPin = resetPin;
    user.resetPinExpiry = Date.now() + 3600000; 
    await user.save();

    await transporter.sendMail({
      to: user.email,
      subject: 'Password Reset Request',
      text: `Your 6-digit PIN for resetting your password is: ${resetPin}. It will expire in 1 hour.`,
    });

    res.status(200).redirect("/resetpassword");
  } catch (error) {
    console.error('Error during password reset request:', error);
    res.status(500).send('An error occurred while requesting password reset.');
  }
});

// Reset Password routes.
app.get('/resetpassword', (req, res) => {
  res.sendFile(__dirname + '/frontend/public/resetpassword.html');
});

app.post('/resetpassword', async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).send('PIN is required.');
    }

    const user = await User.findOne({
      resetPin: pin,
      resetPinExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).send('Invalid or expired PIN.');
    }

    // Store the pin in the session for the new password route
    req.session.resetPin = pin;

    // Redirect to new password page
    res.redirect('/newpassword');
  } catch (error) {
    console.error('Error during PIN validation:', error);
    res.status(500).send('An error occurred while validating the PIN.');
  }
});

app.get('/newpassword', (req, res) => {
  res.sendFile(__dirname + '/frontend/public/newpassword.html');
});

app.post('/newpassword', async (req, res) => {
  try {
    const { password } = req.body;
    const pin = req.session.resetPin; // Retrieve the pin from the session

    if (!password) {
      return res.status(400).send('Password is required.');
    }

    if (!validatePasswordStrength(password)) {
      return res.status(400).send('Password is too weak.');
    }

    const user = await User.findOne({
      resetPin: pin,
      resetPinExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).send('Invalid or expired PIN.');
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPin = undefined;
    user.resetPinExpiry = undefined;
    await user.save();

    // Clear the pin from the session
    req.session.resetPin = undefined;

    res.status(200).send('Password reset successfully!');
  } catch (error) {
    console.error('Error during password reset:', error);
    res.status(500).send('An error occurred while resetting the password.');
  }
});


//Home Page Route
app.get('/', async (req, res) => {

  try {

    const upcomingEvents = await Event.find({ date: { $gte: new Date() } })
      .sort({ date: 1 }) 
      .limit(3); 

    res.render('home', { upcomingEvents }); 
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    res.status(500).send('An error occurred while fetching upcoming events.');
  }
});





// Logout Route
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error during logout:', err);
      return res.status(500).send('An error occurred during logout.');
    }
    res.redirect('/login'); // Redirect to login page after logout
  });
});



//Dashboard Route.
app.get('/dashboard', requireAuth, async (req, res) => {
  const user = req.session.user;  
  
    res.render('dashboard', { user }); 

});

//Invite Routes.
app.get('/invite', requireAuth, (req, res) => {
  res.render('invite'); 
});

app.post('/events/:eventId/invite', requireAuth, async (req, res) => {
  try {
    const { recipientEmail } = req.body;  
    const sender = req.session.user;  
    const { eventId } = req.params;  

    if (!recipientEmail) {
      return res.status(400).send('Recipient email is required.');
    }

    
    const recipientUser = await User.findOne({ email: recipientEmail });

    if (!recipientUser) {
      return res.status(404).send('User with this email not found.');
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).send('Event not found.');
    }

   
    await transporter.sendMail({
      to: recipientUser.email,
      subject: `You're Invited to ${event.name}!`,
      text: `Hi ${recipientUser.name},\n\n${sender.name} has invited you to join the event "${event.name}".\n\nVisit your dashboard for details.`,
    });

    const notification = new Notification({
      user: recipientUser._id,
      event: event._id,
      type: 'Invitation',
      message: `${sender.name} has invited you to the event "${event.name}".`,
    });

    await notification.save();  

    res.status(200).send('Invitation sent successfully.');

  } catch (error) {
    console.error('Error sending invitation:', error);
    res.status(500).send('An error occurred while sending the invitation.');
  }
});


//Notifications Route.
app.get('/notifications', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;

    
    const notifications = await Notification.find({ user: userId }).populate('event');

    res.render('notifications', { notifications });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).send('An error occurred while fetching notifications.');
  }
});


//Profile Routes.
app.get('/profile', requireAuth, async (req, res) => {
  const user = req.session.user; 
  console.log('User data:', user); 

  
  const hostedEvents = await Event.find({ createdBy: user.id });

   const participatedEvents = await Event.find({ attendees: user.id });

    res.render('profile', {

    user: { ...user, hosted_events: hostedEvents, participated_events: participatedEvents }
  });
});


//Edit Profile Routes.
app.get('/editprofile', requireAuth, async (req, res) => {
  const user = req.session.user;
  res.render('editprofile', { user });
});

app.post('/editprofile', requireAuth, async (req, res) => {
  try {
    const { name, email, username, password } = req.body;
    const userId = req.session.user.id;

    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send('User not found');
    }

    
    if (!name || !email || !username) {
      return res.status(400).send('Name, email, and username are required');
    }

   
    const existingUser = await User.findOne({
      $and: [
        { _id: { $ne: userId } },
        { $or: [{ email }, { username }] }
      ]
    });
    if (existingUser) {
      return res.status(400).send('Email or username already in use');
    }

   
    user.name = name;
    user.email = email;
    user.username = username;

    
    if (password) {
      if (!validatePasswordStrength(password)) {
        return res.status(400).send('Password is too weak');
      }
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      username: user.username
    };

    res.redirect('/profile');
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).send('An error occurred while updating the profile');
  }
});


//Events Routes.
app.get('/events', requireAuth, async (req, res) => {
  try {
    const searchQuery = req.query.eventName; 

    let events;

    if (searchQuery) {
     
      events = await Event.find({
        name: { $regex: searchQuery, $options: 'i' }  
      });
    } else {
     
      events = await Event.find();
    }

    res.render('events', { events });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).send('An error occurred while fetching events.');
  }
});





// Create Event Routes.
app.get('/createevent', requireAuth, (req, res) => {
  res.sendFile(__dirname + '/frontend/public/createevent.html');
});

app.post('/createevent', requireAuth, upload.single('event-image'), async (req, res) => {
  try {
    const {hostname, eventName, eventDescription, eventDateTime, eventLocation, eventCapacity, eventCategory } = req.body;

    
    if (!hostname || !eventName || !eventDescription || !eventDateTime || !eventLocation || !eventCapacity || !eventCategory) {
      return res.status(400).send('All fields are required.');
    }

    const eventImage = req.file ? req.file.path : null; 

    const newEvent = new Event({
      hostname: hostname,  
      name: eventName,
      description: eventDescription,
      date: new Date(eventDateTime),
      location: eventLocation,
      capacity: eventCapacity,
      category: eventCategory,
      image: eventImage,
      createdBy: req.session.user.id,
    });
    

    await newEvent.save();
    res.sendFile(__dirname+ '/frontend/public/eventsuccess.html');
  } catch (error){
    console.error('Error creating event:', error);

    res.sendFile(__dirname + '/frontend/public/error.html');
  }
});



// Event Registration Route
app.post('/register-event/:eventId', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params; 
    const userId = req.session.user.id; 

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).send('Invalid event ID.');
    }

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).send('Event not found.');
    }

    if (event.attendees.includes(userId)) {
      return res.status(400).send('You are already registered for this event.');
    }

    if (event.attendees.length >= event.capacity) {
      return res.status(400).send('No available spots for this event.');
    }

    event.attendees.push(userId);
    await event.save();
    await newEvent.save();
    res.sendFile(__dirname+ '/frontend/public/eventsuccess.html');
  } catch (error){
    console.error('Error creating event:', error);

    res.sendFile(__dirname + '/frontend/public/error.html');
  }
});

app.post('/register-event', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.body; 
    const userId = req.session.user.id; 

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).send('Invalid event ID.');
    }

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).send('Event not found.');
    }

    if (event.attendees.includes(userId)) {
      return res.status(400).send('You are already registered for this event.');
    }

    if (event.attendees.length >= event.capacity) {
      return res.status(400).send('No available spots for this event.');
    }

    event.attendees.push(userId);
    await event.save();
    res.sendFile(__dirname+ '/frontend/public/eventregistersuccessfully.html');
  } catch (error){
    console.error('Error creating event:', error);

    res.sendFile(__dirname + '/frontend/public/error.html');
  }
});


app.get('/register-success', (req, res) => {
  const eventId = req.query.eventId;
    res.render('register-for-event', {

    events: yourEventsDataHere,  // Fetch your event data as usual
    successMessage: 'Successfully registered for event!'  // Send success message
  });
});

// My Hosts Route (Show hosted events)
app.get('/myhosts', requireAuth, async (req, res) => {
  try {
    // Fetch the events hosted by the logged-in user
    const hostedEvents = await Event.find({ createdBy: req.session.user.id });

    // Render the hosted events page with the hosted events data
    res.render('myhosts', { hostedEvents });
  } catch (error) {
    console.error('Error fetching hosted events:', error);
    res.status(500).send('An error occurred while fetching hosted events.');
  }
});

// My Registers Route (Show events the user is registered for)
app.get('/myregisters', requireAuth, async (req, res) => {
  try {
    // Fetch the events the logged-in user is registered for
    const registeredEvents = await Event.find({ attendees: req.session.user.id });

    // Render the registered events page with the registered events data
    res.render('myregisters', { registeredEvents });
  } catch (error) {
    console.error('Error fetching registered events:', error);
    res.status(500).send('An error occurred while fetching registered events.');
  }
});

// Add an invite functionality for events
app.post('/invite-user', requireAuth, async (req, res) => {
  try {
    const { eventId, usernameOrEmail } = req.body;
    const user = req.session.user;

    // Find the event being hosted by the user
    const event = await Event.findOne({ _id: eventId, createdBy: user.id });

    if (!event) {
      return res.status(404).send('Event not found or you are not the host.');
    }

    // Find the user to invite (by email or username)
    const invitedUser = await User.findOne({ $or: [{ email: usernameOrEmail }, { username: usernameOrEmail }] });

    if (!invitedUser) {
      return res.status(404).send('User not found.');
    }

    // Send an invitation email with a link
    const invitationLink = `${process.env.BASE_URL}/accept-invitation?eventId=${eventId}&userId=${invitedUser._id}`;
    await transporter.sendMail({
      to: invitedUser.email,
      subject: 'Event Invitation',
      text: `You have been invited to join the event "${event.name}". Click the link to accept the invitation: ${invitationLink}`,
    });

    res.status(200).send('Invitation sent successfully.');
  } catch (error) {
    console.error('Error inviting user:', error);
    res.status(500).send('An error occurred while sending the invitation.');
  }
});

// Route for accepting the invitation
app.get('/accept-invitation', requireAuth, async (req, res) => {
  try {
    const { eventId, userId } = req.query;
    // Find the event
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).send('Event not found.');
    }

    // Check if the user is the invited user
    if (user._id.toString() !== userId) {
      return res.status(403).send('Unauthorized access.');
    }

    // Check if the user is already registered for the event
    if (event.attendees.includes(user._id)) {
      return res.status(400).send('You are already registered for this event.');
    }

    // Add the user to the event attendees
    event.attendees.push(user._id);
    await event.save();

    res.status(200).send('Successfully registered for the event!');
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).send('An error occurred while accepting the invitation.');
  }
});
// Invitation Route
app.post('/invite', requireAuth, async (req, res) => {
  try {
    const { username, email, eventId } = req.body;
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).send('Event not found.');
    }

    const userToInvite = await User.findOne({ $or: [{ username }, { email }] });

    if (!userToInvite) {
      return res.status(404).send('User not found.');
    }

    // Check if the user is already an attendee
    if (event.attendees.includes(userToInvite._id)) {
      return res.status(400).send('User is already registered for this event.');
    }

    // Create a notification
    const notification = new Notification({
      user: userToInvite._id,
      event: event._id,
      type: 'Invitation',
      message: `You have been invited to the event "${event.name}" by ${req.session.user.name}.`,
    });

    await notification.save();

    res.status(200).send('Invitation sent successfully.');
  } catch (error) {
    console.error('Error during invitation:', error);
    res.status(500).send('An error occurred while sending the invitation.');
  }
});

// Event Details Route
app.get('/eventdetails/:eventId', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).send('Invalid event ID.');
    }

    const event = await Event.findById(eventId)
      .populate('createdBy', 'name')
      .populate('attendees', 'name');

    if (!event) {
      return res.status(404).send('Event not found.');
    }

    res.render('eventdetails', { event });
  } catch (error) {
    console.error('Error fetching event details:', error);
    res.status(500).send('An error occurred while fetching event details.');
  }
});

app.get('/eventdetail/:eventId', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).send('Invalid event ID.');
    }

    const event = await Event.findById(eventId)
      .populate('createdBy', 'name')
      .populate('attendees', 'name');

    if (!event) {
      return res.status(404).send('Event not found.');
    }

    res.render('eventInfoPage', { event });
  } catch (error) {
    console.error('Error fetching event details:', error);
    res.status(500).send('An error occurred while fetching event details.');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
