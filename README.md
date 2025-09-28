# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/bcf6b922-d18e-44c0-ae6a-54a3a8295ebc

## Order Details UI & Backend Implementation

This project includes a fully functional, single-column Order Details UI and backend logic for managing orders in the enviofleett/smallchops-09 repository.

### Features

- **Complete Order Details Display**: Single-column layout showing all order information
- **Real-time Status Updates**: Admin controls for updating order status with email notifications
- **Rider Assignment**: Dispatch rider management for delivery orders
- **Customer Information Management**: Editable phone numbers and complete customer data
- **Conditional Sections**: Different sections for pickup vs delivery orders
- **Email Notifications**: Automated email sending on status changes
- **Print Functionality**: Print order details with proper formatting
- **Error Handling**: Comprehensive error states and loading indicators

### File Structure

```
src/
├── components/orders/
│   └── OrderDetailsSingleColumn.tsx    # Main order details component
├── hooks/
│   ├── useDetailedOrderData.ts         # Order data fetching hook
│   ├── useUpdateOrderStatus.ts         # Status update hook
│   └── orderPageHooks.ts               # Combined order page hooks
├── api/
│   ├── orders.ts                       # Order API functions
│   └── users.ts                        # User/rider API functions
├── utils/
│   ├── sendOrderStatusEmail.ts         # Email sending utility
│   └── testOrderStatusEmailSender.ts   # Email testing harness
├── emailTemplates/
│   └── orderStatusTemplates.ts         # Email template functions
├── pages/admin/
│   └── OrderDetailsPage.tsx            # Demo usage page
└── types/
    └── orderDetailsModal.ts            # TypeScript definitions
```

### Setup & Usage

#### Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables in `.env`:
```bash
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Email Configuration (for notifications)
GMAIL_USER=your_gmail_user
GMAIL_PASS=your_gmail_app_password
```

3. Start the development server:
```bash
npm run dev
```

#### Using the Order Details Component

```tsx
import OrderDetailsSingleColumn from '@/components/orders/OrderDetailsSingleColumn';

function OrderPage() {
  return (
    <OrderDetailsSingleColumn 
      orderId="your-order-id" 
      adminEmail="admin@example.com"
    />
  );
}
```

#### Testing Email Functionality

Run the email test harness:

```bash
# Update test configuration in src/utils/testOrderStatusEmailSender.ts
# Then run:
npx ts-node src/utils/testOrderStatusEmailSender.ts
```

### API Integration

The component integrates with:

- **Supabase RPC**: `get_detailed_order_with_products` for order data
- **Edge Functions**: `admin-orders-manager` for order updates
- **Database Tables**: `orders`, `drivers`, `order_items`, etc.
- **Email Service**: Gmail SMTP via Nodemailer

### Component Features

#### UI Sections

1. **Header**: Order number, status badges, connection status, print button
2. **Customer Information**: Name, email, editable phone, payment status
3. **Order Items**: Product list with images, quantities, prices
4. **Delivery Fee**: Separate section for delivery orders
5. **Fulfillment Info**: Delivery/pickup details based on order type
6. **Admin Actions**: Status updates and rider assignment (admin only)
7. **Last Update**: Timestamp and admin officer information

#### Backend Integration

- **Real-time Data**: Uses React Query for caching and real-time updates
- **Status Updates**: Triggers email notifications on successful changes
- **Error Handling**: Comprehensive error states with retry functionality
- **Loading States**: Proper loading indicators for all async operations

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/bcf6b922-d18e-44c0-ae6a-54a3a8295ebc) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase (Backend & Database)
- React Query (State Management)
- React Router (Navigation)
- Sonner (Notifications)

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/bcf6b922-d18e-44c0-ae6a-54a3a8295ebc) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
