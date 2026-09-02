# Le Repertoire (MyLocalFoodie)

A comprehensive hospitality business and venue management platform designed for multi-venue restaurant and hospitality operations. Le Repertoire combines traditional business operations (payroll, compliance, HR) with modern AI capabilities to create a complete operational hub for hospitality businesses.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Installation](#installation)
- [Project Structure](#project-structure)
- [Core Functionality](#core-functionality)
- [API Documentation](#api-documentation)
- [Use Cases](#use-cases)
- [Security Features](#security-features)
- [Configuration](#configuration)
- [Development](#development)
- [License](#license)

## Overview

Le Repertoire is a production-grade, full-stack Python/JavaScript application built with Flask and MongoDB. It serves as a comprehensive management platform for hospitality businesses, offering:

- **AI-Powered Assistance**: Maestro multi-agent chatbot system with specialized personas
- **Recipe & Menu Management**: Complete recipe database with costing and yield calculations
- **Employee Management**: Payroll, leave tracking, and HR operations
- **Compliance Center**: Food safety, employment law, and regulatory resources
- **Business Intelligence**: Event tracking, analytics, and reporting
- **Multi-Venue Support**: Designed for businesses with multiple locations

## Key Features

### 1. Maestro AI Chatbot System

An advanced multi-agent AI system powered by OpenAI with specialized personas:

- **Multiple AI Personas**: Executive Chef, Business Manager, HR Professional, Accountant
- **Retrieval-Augmented Generation (RAG)**: MongoDB Vector Search integration for context-aware responses
- **Task Classification**: Automatic detection of task types and required agent ensembles
- **File Attachments**: Support for PDF, images, and text files in conversations
- **Conversation Memory**: Session-based history tracking with LangCache
- **Tool Calling**: Integration with business systems for agentic workflows

**Key Endpoints:**

```
POST /api/v1/maestro/chat       - Main chat interface
GET  /api/v1/personas/list      - Available personas
GET  /api/v1/maestro/health     - System health check
```

### 2. Recipe Management

Comprehensive recipe database with professional features:

- **Recipe CRUD Operations**: Create, read, update, and delete recipes
- **Ingredient Management**: Detailed ingredient tracking with supplier information
- **Cost Analysis**: Recipe costing with unit conversions and yield percentages
- **Multi-Tab Search**: Global recipes, personal recipes, and venue-specific recipes
- **Recipe Publishing**: Share recipes to global repository
- **Allergen Tracking**: Comprehensive allergen tagging and warnings
- **Dietary Tags**: Support for dietary restrictions and preferences

**Models:**

- Recipe: Instructions, cooking time, yield percentage, cost data, allergen/dietary tags
- Ingredient: Name, supplier, purchase/recipe units, pricing, conversion ratios

### 3. Employee & Payroll Management

Complete HR and payroll solution for hospitality businesses:

- **Employee Records**: Personal information, employment history, next of kin
- **Payroll Processing**: Multiple pay types (hourly, salary, fortnightly, monthly)
- **Tax Calculations**: Australian state tax configurations (VIC, NSW, etc.)
- **Leave Management**: Holiday and sick leave tracking with accrual calculations
- **Work Area Assignment**: Kitchen, front-of-house, management categorization
- **Employment Roles**: Role definitions and hierarchies
- **Payslip Generation**: Automated payslip creation and management

**Features:**

- Tax-free threshold configuration
- Award rates and Fair Work compliance
- Multiple payment rate types per employee
- Accrued employment calculations

### 4. Business Entity Management

Multi-venue business structure support:

- **Company Management**: ACN validation, head office tracking
- **Venue Management**: Multiple locations with operating hours, capacity, equipment
- **Location Tracking**: Address, contact information, and operating details
- **Employee Rosters**: Staff scheduling and shift management

**Entity Types:**

- Multi-venue organizations
- Multi-outlet businesses
- Single-venue operations

### 5. Product & Ingredient Search

Advanced search capabilities for procurement:

- **Product Database**: Comprehensive catalog with supplier tracking
- **Supplier Filtering**: Search by supplier and category
- **Bulk Operations**: Batch product detail retrieval
- **Price Tracking**: Monitor pricing and availability
- **Category Browsing**: Organized product taxonomy

**Endpoints:**

```
GET /api/v1/product-search/search       - Product search
GET /api/v1/product-search/suppliers    - Supplier lookup
GET /api/v1/product-search/categories   - Browse categories
```

### 6. Allergen Management

Comprehensive allergen tracking and compliance:

- **Allergen Database**: Complete allergen information with cross-references
- **Symptom Classification**: Mild, moderate, and severe categorization
- **Action Lists**: Response procedures for each severity level
- **Search & Filtering**: Advanced allergen search with pagination
- **Compliance Documentation**: Emergency contacts and medical notes

**Model Structure:**

- Ingredient-based allergen tracking
- Symptom-based classifications
- Emergency action procedures

### 7. Resources & Compliance Center

Extensive knowledge base for hospitality operations:

**Kitchen Resources:**

- Butchery guides (beef, lamb, pork, game)
- Seasonal produce guides (spring, summer, autumn, winter)
- Prep sheets and inventory management templates
- Temperature logs and cleaning schedules
- Incident reporting forms

**Restaurant Resources:**

- Spirits guides (whiskey, bourbon, gin, rum, tequila)
- Wine guides (red, white, sparkling, fortified, dessert)
- Beer and aperitif information
- Cocktail guides

**Employment Resources:**

- Fair Work compliance documentation
- Award rates and entitlements
- Leave management guidelines
- Payroll procedures

**Compliance Resources:**

- First Aid requirements
- Food safety standards
- Occupational Health & Safety (OHS)
- Responsible Service of Alcohol (RSA)

**Supplier Resources:**

- Local suppliers directory
- Sustainable sourcing guides
- Kitchen and restaurant equipment suppliers

### 8. Calendar & Events Management

Event tracking and scheduling system:

- **Event Categories**: Meetings, milestones, deadlines, training, reminders
- **Venue Association**: Link events to specific locations
- **Date-Based Queries**: Filter by date ranges and categories
- **Full CRUD Operations**: Create, read, update, delete events

**Endpoints:**

```
GET    /api/v1/calendar/events        - List events
POST   /api/v1/calendar/events        - Create event
PUT    /api/v1/calendar/events/<id>   - Update event
DELETE /api/v1/calendar/events/<id>   - Delete event
```

### 9. Menu Development Tools

Professional menu planning and optimization:

- Menu planning interface with drag-and-drop
- Recipe integration for menu items
- Cost analysis across menu offerings
- Nutritional tracking
- Menu forecasting and optimization

### 10. Authentication & Security

Robust authentication system with multiple options:

- **Local Authentication**: Username/payroll-ID with bcrypt password hashing
- **Google OAuth 2.0**: Seamless social login integration
- **JWT Tokens**: Session token generation and refresh
- **CSRF Protection**: Token-based protection on all POST requests
- **Secure Sessions**: Cookie-based with HTTPS-only in production

**Endpoints:**

```
POST /auth/login                - Local authentication
POST /auth/login/google         - OAuth token exchange
GET  /auth/google-config        - OAuth configuration
POST /auth/token/refresh        - Token renewal
GET  /auth/logout               - Session termination
```

## Technology Stack

### Backend

- **Framework**: Flask 2.3.2 with application factory pattern
- **Database**: MongoDB with MongoEngine 0.29.1 ORM
- **Caching**: Redis 5.0.0 with LangCache integration
- **Authentication**:
  - Google OAuth (google-auth, google-auth-oauthlib)
  - JWT (PyJWT 2.8.0)
  - bcrypt password hashing
- **Server**: Gunicorn 21.2.0, Waitress 3.0.2

### AI/LLM Integration

- **Primary LLM**: OpenAI API v1.35.12
- **Embeddings**: Voyage AI embeddings
- **Vector Search**: MongoDB Atlas Vector Search
- **Chatbot Framework**: Custom Maestro multi-agent system
- **Memory**: Redis-based LangCache for conversation history

### Frontend

- **CSS Framework**: Tailwind CSS 3.4.0
- **Build Tools**: PostCSS, autoprefixer
- **Template Engine**: Jinja2 3.1.6
- **JavaScript**: Vanilla JS + jQuery 3.4.1
- **UI Components**: Custom modular components with drag-and-drop

### Additional Services

- **CDN**: BunnyCDN for media delivery
- **Web Scraping**: Selenium 4.27.1
- **PDF Processing**: PyPDF, pytesseract, pdf2image, Pillow (OCR support)
- **HTTP Clients**: aiohttp, httpx, requests
- **Async Libraries**: asyncio, trio, aiohttp

### Development & Testing

- **Testing**: pytest 8.3.4
- **Type Hints**: typing_extensions
- **Logging**: Structured Python logging
- **Version Control**: Git

## Installation

### Prerequisites

- Python 3.8+
- MongoDB 4.0+
- Redis 5.0+
- Node.js 14+ (for Tailwind CSS build)
- Tesseract OCR (for PDF processing)

### Setup Steps

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd MyLocalFoodie
   ```

2. **Create virtual environment**

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install Python dependencies**

   ```bash
   pip install -r requirements.txt
   ```

4. **Install Node.js dependencies**

   ```bash
   npm install
   ```

5. **Configure environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

   Required environment variables:
   - `MONGODB_URI`: MongoDB connection string
   - `REDIS_URL`: Redis connection URL
   - `OPENAI_API_KEY`: OpenAI API key
   - `VOYAGE_API_KEY`: Voyage AI API key
   - `GOOGLE_OAUTH_CLIENT_ID`: Google OAuth client ID
   - `GOOGLE_OAUTH_CLIENT_SECRET`: Google OAuth client secret
   - `SECRET_KEY`: Flask secret key
   - `JWT_SECRET_KEY`: JWT signing key

6. **Build Tailwind CSS**

   ```bash
   npm run build:css
   ```

7. **Initialize database**

   ```bash
   python -m app.scripts.init_db
   ```

8. **Run the application**

   ```bash
   # Development
   flask run

   # Production
   gunicorn -w 4 -b 0.0.0.0:8000 app:app
   ```

## Project Structure

```
MyLocalFoodie/
├── app/                          # Main Flask application
│   ├── __init__.py              # Application factory
│   ├── api/                      # API endpoints
│   │   └── v1/
│   │       ├── features/         # Feature modules (auto-registered)
│   │       │   ├── auth/         # Authentication
│   │       │   ├── maestro/      # AI chatbot
│   │       │   ├── recipe_search/ # Recipe search
│   │       │   ├── product_search/ # Product search
│   │       │   ├── allergen_search/ # Allergen search
│   │       │   ├── tags_search/  # Tags search
│   │       │   └── calendar/     # Events calendar
│   │       └── chatbot/          # Chatbot interface
│   ├── config/                   # Configuration modules
│   │   ├── base_config.py        # Environment configs
│   │   ├── auth/                 # Auth configuration
│   │   ├── mongo/                # MongoDB configuration
│   │   ├── redis_langcache/      # Redis configuration
│   │   └── payroll/              # Payroll tax configs
│   ├── models/                   # MongoEngine models
│   │   ├── business_entities/    # Company, venue, employee models
│   │   ├── recipe/               # Recipe and ingredient models
│   │   ├── allergens/            # Allergen models
│   │   ├── events/               # Calendar event models
│   │   ├── tags/                 # Tag models
│   │   └── payroll/              # Payroll models
│   ├── modules/                  # Feature modules
│   ├── registries/               # Auto-discovery registries
│   │   ├── blueprint_registry.py # API blueprint registration
│   │   ├── routes_registry.py    # Web routes registration
│   │   └── models_registry.py    # Model registration
│   ├── routes/                   # Web routes
│   │   ├── recipe/               # Recipe management routes
│   │   ├── menu_dev/             # Menu development routes
│   │   └── resources/            # Resource center routes
│   ├── scripts/                  # Utility scripts
│   └── utils/                    # Helper utilities
├── templates/                    # Jinja2 templates
│   ├── base/                     # Base layouts
│   ├── chatbot/                  # Chatbot UI
│   ├── recipe/                   # Recipe templates
│   ├── resources/                # Resource center
│   ├── components/               # Reusable components
│   └── errors/                   # Error pages
├── static/                       # Static assets
│   ├── css/                      # Compiled CSS
│   ├── js/                       # JavaScript modules
│   ├── images/                   # Images
│   └── fonts/                    # Custom fonts
├── rag_ingest/                   # RAG PDF ingestion tools
├── ci/                           # CI/CD configuration
├── package.json                  # Node.js dependencies
├── requirements.txt              # Python dependencies
├── postcss.config.js             # PostCSS configuration
└── README.md                     # This file
```

## Core Functionality

### Auto-Discovery Registry System

Le Repertoire uses an advanced auto-discovery pattern for maximum modularity:

**Blueprint Registry**: Automatically discovers and registers API blueprints from `app/api/v1/features/` without manual registration.

**Routes Registry**: Auto-discovers route modules (`*_routes.py` files) for web endpoints.

**Models Registry**: Auto-registers MongoEngine models on application startup.

**Personas Registry**: Discovers chatbot personas from YAML/Markdown files.

**Benefits:**

- No manual blueprint registration required
- Scalable, plugin-like architecture
- Easy to add new features without modifying core code
- Backwards compatibility with fallback mechanisms

### Security Architecture

**CSRF Protection**: Flask-WTF with CSRF tokens on all POST requests

**Content Security Policy (CSP)**: Nonce-based inline script protection with per-request nonce generation

**NoSQL Injection Prevention**: Input sanitization on MongoDB queries

**Security Headers**:

- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Strict-Transport-Security (HSTS)
- Referrer-Policy: no-referrer

**Password Management**: bcrypt hashing with 12+ character requirement

**Session Management**: JWT + session hybrid with secure cookies (HTTPS-only in production)

### Error Handling

- Centralized error handlers for 404, 403, 500 errors
- Safe template fallbacks with JSON alternatives for API requests
- Structured error responses with CSP support
- Debug information in development mode
- Production-safe error messages

## API Documentation

### Authentication Endpoints

| Method | Endpoint              | Description                    |
| ------ | --------------------- | ------------------------------ |
| GET    | `/auth/`              | Login page                     |
| POST   | `/auth/login`         | Local authentication           |
| POST   | `/auth/login/google`  | Google OAuth token exchange    |
| GET    | `/auth/google-config` | OAuth configuration            |
| GET    | `/auth/dashboard`     | Post-login dashboard           |
| GET    | `/auth/logout`        | Logout and session termination |
| POST   | `/auth/token/refresh` | JWT token refresh              |

### Maestro Chatbot Endpoints

| Method | Endpoint                  | Description               |
| ------ | ------------------------- | ------------------------- |
| GET    | `/api/v1/maestro/health`  | Health check              |
| POST   | `/api/v1/maestro/chat`    | Main chat endpoint (JSON) |
| POST   | `/api/v1/maestro/respond` | Compatibility endpoint    |
| GET    | `/api/v1/personas/list`   | List available personas   |
| GET    | `/api/v1/personas/<id>`   | Get persona details       |

### Recipe Endpoints

| Method | Endpoint                        | Description                   |
| ------ | ------------------------------- | ----------------------------- |
| GET    | `/api/v1/recipes/search/global` | Search global recipes         |
| GET    | `/api/v1/recipes/search/mine`   | Search user's recipes         |
| GET    | `/api/v1/recipes/search/venue`  | Search venue-specific recipes |
| GET    | `/recipes/<recipe_id>`          | Get recipe details            |

### Product Search Endpoints

| Method | Endpoint                                  | Description           |
| ------ | ----------------------------------------- | --------------------- |
| GET    | `/api/v1/product-search/search`           | Search products       |
| GET    | `/api/v1/product-search/suppliers/search` | Search suppliers      |
| GET    | `/api/v1/product-search/categories`       | Browse categories     |
| GET    | `/api/v1/product-search/bulk`             | Batch product details |

### Allergen Endpoints

| Method | Endpoint                         | Description                   |
| ------ | -------------------------------- | ----------------------------- |
| GET    | `/api/v1/allergen-search/search` | Search allergens with filters |

### Tags Endpoints

| Method | Endpoint                      | Description                   |
| ------ | ----------------------------- | ----------------------------- |
| GET    | `/api/v1/tags_search/suggest` | Tag auto-complete suggestions |

### Calendar Endpoints

| Method | Endpoint                       | Description       |
| ------ | ------------------------------ | ----------------- |
| GET    | `/api/v1/calendar/events`      | List events       |
| POST   | `/api/v1/calendar/events`      | Create event      |
| GET    | `/api/v1/calendar/events/<id>` | Get event details |
| PUT    | `/api/v1/calendar/events/<id>` | Update event      |
| DELETE | `/api/v1/calendar/events/<id>` | Delete event      |

### Web Navigation Routes

| Route                   | Description                     |
| ----------------------- | ------------------------------- |
| `/home`                 | Main dashboard                  |
| `/menu-development`     | Menu development tools          |
| `/recipes`              | Recipe management               |
| `/rosters`              | Staff rosters                   |
| `/ordering`             | Ordering system                 |
| `/reporting`            | Reports and analytics           |
| `/staff`                | Staff management                |
| `/resources`            | Resources and compliance center |
| `/settings/profile`     | User profile settings           |
| `/settings/preferences` | User preferences                |
| `/settings/security`    | Security settings               |

## Use Cases

### Primary Users

1. **Venue/Restaurant Managers**: Operations management, menu planning, staff coordination
2. **Executive Chefs & Kitchen Staff**: Recipe management, ingredient sourcing, menu development
3. **Business Owners**: Financial oversight, compliance tracking, employee management
4. **Human Resources Managers**: Payroll processing, leave management, employee records
5. **Accountants**: Payroll, tax calculations, financial reporting

### Common Workflows

**Recipe Development & Costing:**

1. Create recipe with ingredients and instructions
2. Calculate recipe cost with yield percentages
3. Tag allergens and dietary information
4. Publish to venue or global repository
5. Use in menu planning and forecasting

**Employee Onboarding:**

1. Create employee record with personal details
2. Assign work area and employment role
3. Configure pay rate and tax settings
4. Set up leave entitlements
5. Generate initial payroll records

**Menu Planning:**

1. Browse recipes from global, personal, or venue collections
2. Analyze recipe costs and profitability
3. Create menu with drag-and-drop interface
4. Review nutritional information and allergens
5. Forecast menu performance

**AI-Assisted Operations:**

1. Select appropriate Maestro persona (Chef, Manager, HR, etc.)
2. Ask questions or request assistance
3. Upload relevant documents (PDFs, images)
4. Receive context-aware responses with RAG
5. Get actionable recommendations

**Compliance Management:**

1. Access resource center for regulatory information
2. Review food safety standards
3. Check employment law requirements
4. Download forms and templates
5. Track compliance events in calendar

**Payroll Processing:**

1. Review employee time records
2. Calculate pay with tax deductions
3. Generate payslips
4. Process leave accruals
5. Export financial reports

## Security Features

| Feature                        | Implementation      | Details                                                    |
| ------------------------------ | ------------------- | ---------------------------------------------------------- |
| **CSRF Protection**            | Flask-WTF           | Token-based, session-based, HTTPS in production            |
| **Content Security Policy**    | Custom middleware   | Nonce injection for inline scripts, per-request generation |
| **Password Security**          | bcrypt              | 12+ char requirement, salted hashing, secure defaults      |
| **NoSQL Injection Prevention** | Input sanitization  | Query parameter escaping, MongoDB-specific filters         |
| **Session Management**         | JWT + Cookie        | Secure cookies, HTTPS-only in production, token refresh    |
| **Security Headers**           | Custom middleware   | X-Frame, X-Content-Type, HSTS, Referrer-Policy             |
| **OAuth Integration**          | google-auth library | Token validation, secure redirect handling, PKCE support   |
| **Input Validation**           | WTForms             | Form validation, type checking, sanitization               |

## Configuration

### Environment-Based Configuration

Le Repertoire supports multiple environments with separate configurations:

- **Development**: Debug mode, relaxed security, local services
- **Testing**: Test database, disabled external services
- **Production**: Strict security, HTTPS enforcement, optimized caching

### Configuration Files

| File                                                   | Purpose                             |
| ------------------------------------------------------ | ----------------------------------- |
| `.env`                                                 | Environment variables (not in repo) |
| `app/config/base_config.py`                            | Base configuration class            |
| `app/config/auth/google_oauth_config.py`               | Google OAuth settings               |
| `app/config/mongo/mongoDB_config.py`                   | MongoDB connection                  |
| `app/config/redis_langcache/redis_langcache_config.py` | Redis & LangCache                   |
| `app/config/payroll/`                                  | Tax configurations (VIC, NSW, etc.) |

### Key Configuration Options

**Flask Settings:**

- `SECRET_KEY`: Session encryption key
- `WTF_CSRF_ENABLED`: CSRF protection toggle
- `SESSION_COOKIE_SECURE`: HTTPS-only cookies
- `MAX_CONTENT_LENGTH`: File upload size limit

**MongoDB Settings:**

- `MONGODB_URI`: Connection string with authentication
- `MONGODB_DB`: Database name
- `MONGODB_CONNECT`: Connection pooling settings

**Redis Settings:**

- `REDIS_URL`: Redis connection URL
- `CACHE_TYPE`: Cache backend type
- `CACHE_DEFAULT_TIMEOUT`: Default cache TTL

**OpenAI Settings:**

- `OPENAI_API_KEY`: API authentication key
- `OPENAI_MODEL`: Default model (gpt-4, gpt-3.5-turbo)
- `OPENAI_TEMPERATURE`: Response randomness (0-2)

**Google OAuth Settings:**

- `GOOGLE_OAUTH_CLIENT_ID`: OAuth client ID
- `GOOGLE_OAUTH_CLIENT_SECRET`: OAuth client secret
- `GOOGLE_OAUTH_REDIRECT_URI`: Callback URL

## Development

### Running in Development Mode

```bash
# Activate virtual environment
source venv/bin/activate

# Set environment
export FLASK_ENV=development
export FLASK_APP=app

# Run with auto-reload
flask run --reload

# Or with debug mode
python -m flask run --debug
```

### Building Tailwind CSS

```bash
# Development (watch mode)
npm run watch:css

# Production build (minified)
npm run build:css
```

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_auth.py

# Run with verbose output
pytest -v
```

### Database Migrations

```bash
# Initialize database
python -m app.scripts.init_db

# Seed sample data
python -m app.scripts.seed_data

# Clear cache
python -m app.scripts.clear_cache
```

### RAG PDF Ingestion

```bash
# Ingest PDFs from directory
python rag_ingest/ingest_pdfs.py --source ./pdfs --output ./markdown

# Process single PDF
python rag_ingest/ingest_pdfs.py --file ./pdfs/document.pdf
``

```

### Code Style & Standards

- **Commit Messages**: Conventional commits format

### Debugging

**Flask Debug Toolbar**: Available in development mode at `/_debug_toolbar`

**Logging**: Check logs in `logs/` directory or console output

**MongoDB**: Use MongoDB Compass to inspect collections

**Redis**: Use redis-cli to check cache keys

## Database Collections

| Collection          | Purpose                   | Key Indexes                    |
| ------------------- | ------------------------- | ------------------------------ |
| `business_entities` | Company and venue records | entity_id, entity_type         |
| `employees`         | Employee master records   | payroll_id, linking_id         |
| `recipes`           | Recipe database           | recipe_id, name, created_by    |
| `ingredients`       | Ingredient master list    | ingredient_id, name            |
| `products_list`     | Product catalog           | name, SUPPLIER, category       |
| `allergens`         | Allergen database         | ingredient (unique)            |
| `tags`              | Tag system                | name (text index), type        |
| `events`            | Calendar events           | event_date, category, venue_id |
| `chat_sessions`     | Chatbot conversations     | session_id, user_id            |
| `payslips`          | Payroll records           | payroll_id, period_start       |

## Performance Optimization

- **MongoDB Indexes**: Optimized queries on frequently accessed fields
- **Redis Caching**: Response caching for search results and API calls
- **LangCache**: AI response caching to reduce OpenAI API costs
- **Vector Search**: MongoDB Atlas Vector Search for semantic retrieval
- **Async Operations**: aiohttp and asyncio for concurrent requests
- **CDN Integration**: BunnyCDN for static asset delivery
- **Lazy Loading**: Dynamic imports for feature modules
- **Query Optimization**: MongoEngine query optimization with select_related

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow code style guidelines
4. Add tests for new functionality
5. Ensure all tests pass
6. Commit with conventional commit messages
7. Push to your fork
8. Open a pull request

## License

This project is proprietary software. All rights reserved.

## Support & Contact

For support, bug reports, or feature requests:

- **Issues**: Open an issue on the repository
- **Documentation**: Check the `/docs` directory
- **Email**: contact@lerepertoire.com

## Acknowledgments

- OpenAI for AI capabilities
- MongoDB for database platform
- Flask community for excellent framework
- Tailwind CSS for styling system
- All open-source contributors

---

**Version**: 1.0.0
**Last Updated**: 2025
**Status**: Production Ready
