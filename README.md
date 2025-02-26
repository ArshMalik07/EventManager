# EventManager

## Overview
EventManager is a web application designed to help users manage events efficiently. It allows users to create, edit, and register for events seamlessly.

## Technologies Used
- **Node.js**: The server-side JavaScript runtime.
- **Express**: A web application framework for Node.js.
- **MongoDB**: A NoSQL database, accessed via Mongoose.
- **EJS**: A templating engine for rendering HTML.

### Key Dependencies
- **bcrypt**: For hashing passwords.
- **body-parser**: Middleware for parsing request bodies.
- **dotenv**: For loading environment variables from a `.env` file.
- **express-session**: For managing user sessions.
- **multer**: For handling file uploads.
- **nodemailer**: For sending emails.
- **sequelize**: A promise-based Node.js ORM for SQL databases.

### Development Dependencies
- **Babel**: For transpiling modern JavaScript and React code.
- **Nodemon**: For automatically restarting the server during development.


## Features
- Create new events
- Edit existing events
- User registration and login
- View event details
- Notifications for upcoming events

## Getting Started

### Prerequisites
- Node.js installed on your machine
- MongoDB for database management

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/EventManager.git
   ```
2. Navigate to the project directory:
   ```bash
   cd EventManager
   ```
3. Install the required dependencies:
   ```bash
   npm install
   ```

### Running the Application
To start the application, run:
```bash
npm start
```
The application will be available at `http://localhost:3000`.

### Usage
- To create an event, navigate to the "Create Event" page.
- To view events, go to the "Events" page.
- Users can register and log in to manage their events.

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any suggestions or improvements.
