# WOWMANIA Backend - Handloom Collection

A comprehensive Node.js backend for the WOWMANIA luxury heritage fashion e-commerce mobile application, built with Express.js, TypeScript, and MongoDB.

## 🚀 Features

### Core Functionality
- **User Management**: Registration, authentication, profile management, address management
- **Product Management**: CRUD operations, categories, variants, inventory management
- **Shopping Cart**: Add/remove items, quantity management, cart persistence
- **Order Management**: Order creation, status tracking, payment processing
- **Payment Integration**: Stripe payment processing with webhooks
- **Review System**: Product reviews and ratings with moderation
- **Wishlist**: Save favorite products with sharing capabilities
- **Notifications**: Real-time notifications for order updates and promotions
- **Admin Dashboard**: Comprehensive admin panel with analytics and management tools

### Technical Features
- **Authentication**: JWT with refresh token rotation
- **Security**: Rate limiting, input validation, XSS protection, CORS
- **Performance**: Redis caching, database indexing, compression
- **Real-time**: Socket.IO for live updates
- **File Upload**: Image upload with AWS S3/Cloudinary support
- **Logging**: Winston logging with file rotation
- **Error Handling**: Centralized error handling with custom error classes

## 🛠 Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Cache**: Redis
- **Authentication**: JWT (JSON Web Tokens)
- **Payment**: Stripe
- **File Storage**: AWS S3 / Cloudinary
- **Email**: Nodemailer with SendGrid/AWS SES
- **Real-time**: Socket.IO
- **Validation**: Express-validator
- **Security**: Helmet.js, rate limiting, XSS protection
- **Logging**: Winston, Morgan

## 📁 Project Structure

```
src/
├── config/           # Configuration files
│   ├── database.ts   # MongoDB connection
│   ├── redis.ts      # Redis connection
│   ├── env.ts        # Environment validation
│   └── logger.ts     # Winston logger setup
├── middleware/       # Express middleware
│   ├── auth.ts       # Authentication & authorization
│   ├── cache.ts      # Redis caching
│   ├── errorHandler.ts # Error handling
│   ├── fileUpload.ts # File upload with Multer
│   ├── notFound.ts   # 404 handler
│   └── validation.ts # Request validation
├── models/          # Mongoose models
│   ├── User.ts      # User model
│   ├── Product.ts   # Product model
│   ├── Order.ts     # Order model
│   ├── Cart.ts      # Cart model
│   ├── Category.ts  # Category model
│   ├── Review.ts    # Review model
│   ├── Wishlist.ts  # Wishlist model
│   └── Notification.ts # Notification model
├── routes/          # API routes
│   ├── auth.ts      # Authentication routes
│   ├── user.ts      # User management routes
│   ├── product.ts   # Product routes
│   ├── cart.ts      # Cart routes
│   ├── order.ts     # Order routes
│   ├── payment.ts   # Payment routes
│   ├── category.ts  # Category routes
│   ├── review.ts    # Review routes
│   ├── wishlist.ts  # Wishlist routes
│   ├── notification.ts # Notification routes
│   └── admin.ts     # Admin routes
├── socket/          # Socket.IO handlers
│   └── handlers.ts  # Real-time event handlers
├── types/           # TypeScript type definitions
│   └── index.ts     # Custom types and interfaces
└── server.ts        # Main application entry point
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MongoDB
- Redis
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd wowmania_backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   # Server Configuration
   NODE_ENV=development
   PORT=5000
   API_VERSION=v1
   
   # MongoDB
   MONGODB_URI=mongodb://localhost:27017/wowmania
   
   # JWT
   JWT_SECRET=your-jwt-secret
   JWT_REFRESH_SECRET=your-refresh-secret
   JWT_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d
   
   # Redis
   REDIS_URL=redis://localhost:6379
   
   # Stripe
   STRIPE_SECRET_KEY=your-stripe-secret-key
   STRIPE_WEBHOOK_SECRET=your-webhook-secret
   
   # File Upload
   UPLOAD_PATH=uploads
   MAX_FILE_SIZE=5242880
   
   # Email (SendGrid)
   SENDGRID_API_KEY=your-sendgrid-key
   EMAIL_FROM=noreply@wowmania.com
   
   # AWS S3 (optional)
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=your-bucket-name
   
   # Cloudinary (optional)
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   npm start
   ```

## 📚 API Documentation

### Authentication Endpoints

- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/forgot-password` - Forgot password
- `POST /api/v1/auth/reset-password` - Reset password
- `GET /api/v1/auth/me` - Get current user profile

### User Management

- `GET /api/v1/users` - Get all users (admin)
- `GET /api/v1/users/:id` - Get user by ID
- `PUT /api/v1/users/profile` - Update user profile
- `PUT /api/v1/users/:id` - Update user (admin)
- `DELETE /api/v1/users/:id` - Delete user (admin)
- `GET /api/v1/users/addresses` - Get user addresses
- `POST /api/v1/users/addresses` - Add address
- `PUT /api/v1/users/addresses/:id` - Update address
- `DELETE /api/v1/users/addresses/:id` - Delete address

### Product Management

- `GET /api/v1/products` - Get all products with filtering
- `GET /api/v1/products/featured` - Get featured products
- `GET /api/v1/products/bestsellers` - Get best selling products
- `GET /api/v1/products/new-arrivals` - Get new arrivals
- `GET /api/v1/products/on-sale` - Get products on sale
- `GET /api/v1/products/:id` - Get single product
- `POST /api/v1/products` - Create product (admin)
- `PUT /api/v1/products/:id` - Update product (admin)
- `DELETE /api/v1/products/:id` - Delete product (admin)

### Category Management

- `GET /api/v1/categories` - Get all categories
- `GET /api/v1/categories/featured` - Get featured categories
- `GET /api/v1/categories/root` - Get root categories
- `GET /api/v1/categories/:id` - Get category by ID
- `GET /api/v1/categories/slug/:slug` - Get category by slug
- `POST /api/v1/categories` - Create category (admin)
- `PUT /api/v1/categories/:id` - Update category (admin)
- `DELETE /api/v1/categories/:id` - Delete category (admin)

### Shopping Cart

- `GET /api/v1/cart` - Get user's cart
- `POST /api/v1/cart/add` - Add item to cart
- `PUT /api/v1/cart/items/:id` - Update cart item
- `DELETE /api/v1/cart/items/:id` - Remove item from cart
- `POST /api/v1/cart/clear` - Clear cart
- `POST /api/v1/cart/coupon/apply` - Apply coupon
- `DELETE /api/v1/cart/coupon/remove` - Remove coupon
- `GET /api/v1/cart/summary` - Get cart summary

### Order Management

- `GET /api/v1/orders` - Get user's orders
- `GET /api/v1/orders/:id` - Get order by ID
- `POST /api/v1/orders` - Create order from cart
- `PUT /api/v1/orders/:id` - Update order (admin)
- `POST /api/v1/orders/:id/status` - Update order status (admin)
- `POST /api/v1/orders/:id/cancel` - Cancel order
- `GET /api/v1/orders/:id/invoice` - Get order invoice

### Payment Processing

- `POST /api/v1/payments/create-intent` - Create payment intent
- `POST /api/v1/payments/confirm` - Confirm payment
- `POST /api/v1/payments/webhook` - Stripe webhook handler
- `POST /api/v1/payments/:orderId/refund` - Process refund
- `GET /api/v1/payments/:orderId/status` - Get payment status
- `GET /api/v1/payments/methods` - Get payment methods

### Reviews & Ratings

- `GET /api/v1/reviews/product/:productId` - Get product reviews
- `GET /api/v1/reviews/user` - Get user's reviews
- `POST /api/v1/reviews` - Create review
- `PUT /api/v1/reviews/:id` - Update review
- `DELETE /api/v1/reviews/:id` - Delete review
- `POST /api/v1/reviews/:id/helpful` - Mark review as helpful
- `POST /api/v1/reviews/:id/report` - Report review

### Wishlist

- `GET /api/v1/wishlist` - Get user's wishlist
- `POST /api/v1/wishlist/add` - Add item to wishlist
- `DELETE /api/v1/wishlist/remove/:id` - Remove item from wishlist
- `PUT /api/v1/wishlist/update/:id` - Update wishlist item
- `POST /api/v1/wishlist/clear` - Clear wishlist
- `POST /api/v1/wishlist/share` - Share wishlist
- `GET /api/v1/wishlist/shared/:token` - Get shared wishlist

### Notifications

- `GET /api/v1/notifications` - Get user's notifications
- `GET /api/v1/notifications/unread` - Get unread count
- `PUT /api/v1/notifications/:id/read` - Mark as read
- `PUT /api/v1/notifications/:id/archive` - Archive notification
- `POST /api/v1/notifications/read-all` - Mark all as read

### Admin Routes

- `GET /api/v1/admin/dashboard` - Dashboard statistics
- `GET /api/v1/admin/users` - User management
- `GET /api/v1/admin/inventory` - Inventory overview
- `GET /api/v1/admin/analytics/sales` - Sales analytics
- `GET /api/v1/admin/analytics/products` - Product analytics
- `GET /api/v1/admin/system/health` - System health
- `GET /api/v1/admin/content/reviews` - Review moderation
- `GET /api/v1/admin/reports/sales` - Sales reports

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run seed` - Seed database with sample data
- `npm run migrate` - Run database migrations

### Database Seeding

```bash
npm run seed
```

This will create sample data including:
- Admin users
- Product categories
- Sample products
- Test orders

### Testing

```bash
npm test
```

## 🚀 Deployment

### Docker Deployment

1. **Build the Docker image**
   ```bash
   docker build -t wowmania-backend .
   ```

2. **Run the container**
   ```bash
   docker run -p 5000:5000 --env-file .env wowmania-backend
   ```

### Environment Variables

Make sure to set all required environment variables in your production environment:

- Database connection strings
- JWT secrets
- API keys (Stripe, SendGrid, AWS, etc.)
- Redis connection
- CORS origins
- Rate limiting settings

## 🔒 Security Features

- **Authentication**: JWT with refresh token rotation
- **Authorization**: Role-based access control (RBAC)
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: API rate limiting to prevent abuse
- **XSS Protection**: Cross-site scripting protection
- **CORS**: Configurable CORS settings
- **Helmet.js**: Security headers
- **MongoDB Sanitization**: Prevent NoSQL injection
- **Password Hashing**: bcrypt with configurable rounds

## 📊 Monitoring & Logging

- **Winston Logging**: Structured logging with file rotation
- **Morgan**: HTTP request logging
- **Error Tracking**: Centralized error handling
- **Health Checks**: System health monitoring
- **Performance Monitoring**: Response time tracking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the API documentation

## 🔄 Version History

- **v1.0.0** - Initial release with core e-commerce functionality
- **v1.1.0** - Added review system and wishlist features
- **v1.2.0** - Enhanced admin dashboard and analytics
- **v1.3.0** - Added notification system and real-time updates

---

**WOWMANIA Backend** - Powering luxury heritage fashion e-commerce with modern technology.
