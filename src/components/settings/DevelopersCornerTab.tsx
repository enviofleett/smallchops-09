
import React from "react";
import { Accordion } from "@/components/ui/accordion";
import CodeGroupAccordion from "./developers-corner/CodeGroupAccordion";

const frontendGroups = [
  {
    title: "Authentication & Users",
    description: "All components related to customer authentication, profiles, and user management.",
    examples: [
      {
        label: "Customer Profile (View/Update)",
        code: `import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
const CustomerProfile = () => {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return;
      const { data } = await supabase.from("customers").select("*").eq("id", user.id).single();
      setProfile(data);
      setForm({ name: data?.name ?? "", email: data?.email ?? "", phone: data?.phone ?? "" });
    };
    fetchProfile();
  }, []);
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const save = async () => {
    await supabase.from("customers").update(form).eq("id", profile.id);
    setEditing(false);
  };
  if (!profile) return <div>Loading...</div>;
  return editing ? (
    <form onSubmit={e => {e.preventDefault();save();}}>
      <input name="name" value={form.name} onChange={handleChange} />
      <input name="email" value={form.email} onChange={handleChange} />
      <input name="phone" value={form.phone} onChange={handleChange} />
      <button type="submit">Save</button>
    </form>
  ) : (
    <div>
      <div>Name: {profile.name}</div>
      <div>Email: {profile.email}</div>
      <div>Phone: {profile.phone}</div>
      <button onClick={() => setEditing(true)}>Edit</button>
    </div>
  );
};`,
        notes: "Basic editable customer profile, requires Supabase authentication."
      },
      {
        label: "Login/Signup Component",
        code: `import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
const AuthForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    const redirectUrl = \`\${window.location.origin}/\`;
    
    const { error } = isLogin 
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ 
          email, 
          password, 
          options: { emailRedirectTo: redirectUrl }
        });
    
    if (error) alert(error.message);
    setLoading(false);
  };

  return (
    <form onSubmit={handleAuth} className="space-y-4 max-w-md mx-auto">
      <h2>{isLogin ? "Login" : "Sign Up"}</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full p-2 border rounded"
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full p-2 border rounded"
        required
      />
      <button type="submit" disabled={loading} className="w-full bg-blue-500 text-white p-2 rounded">
        {loading ? "Loading..." : (isLogin ? "Login" : "Sign Up")}
      </button>
      <button type="button" onClick={() => setIsLogin(!isLogin)} className="w-full text-blue-500">
        {isLogin ? "Need an account? Sign up" : "Have an account? Login"}
      </button>
    </form>
  );
};`,
        notes: "Complete authentication form with login/signup toggle."
      }
    ]
  },
  {
    title: "Products & Catalog",
    description: "Display, search, and filter products and categories from your Supabase-backed API.",
    examples: [
      {
        label: "Fetch All Products",
        code: `import { useQuery } from "@tanstack/react-query";
const fetchProducts = async () => {
  const res = await fetch("https://lpcviyjdsgghvuddthxr.supabase.co/functions/v1/get-public-products");
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};
export const Products = () => {
  const { data, isLoading, error } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading products</div>;
  return <ul>{data.map(prod => <li key={prod.id}>{prod.name} – ₦{prod.price}</li>)}</ul>;
};`,
        notes: "Lists all active products with their prices."
      },
      {
        label: "Product Details Component",
        code: `import { useState } from "react";
const ProductCard = ({ product, onAddToCart }) => {
  const [quantity, setQuantity] = useState(1);
  
  return (
    <div className="border rounded-lg p-4 shadow-sm">
      <img src={product.image_url} alt={product.name} className="w-full h-48 object-cover rounded" />
      <h3 className="font-bold mt-2">{product.name}</h3>
      <p className="text-gray-600 text-sm">{product.description}</p>
      <div className="flex items-center justify-between mt-4">
        <span className="text-lg font-bold">₦{product.price}</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value))}
            className="w-16 p-1 border rounded"
          />
          <button
            onClick={() => onAddToCart(product, quantity)}
            className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
};`,
        notes: "Reusable product card with add to cart functionality."
      },
      {
        label: "List Categories and Filter Products",
        code: `import { useState } from "react";
const CategoriesAndProducts = () => {
  const [cat, setCat] = useState("");
  const [cats, setCats] = React.useState([]);
  const [prods, setProds] = React.useState([]);
  React.useEffect(() => {
    fetch("https://lpcviyjdsgghvuddthxr.supabase.co/functions/v1/get-public-categories")
      .then(r => r.json()).then(setCats);
  }, []);
  React.useEffect(() => {
    if (!cat) return setProds([]);
    fetch(\`https://lpcviyjdsgghvuddthxr.supabase.co/functions/v1/get-products-by-category?category_id=\${cat}\`)
      .then(r => r.json()).then(setProds);
  }, [cat]);
  return (
    <div>
      <select onChange={e => setCat(e.target.value)}>
        <option value="">Select category</option>
        {cats.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
      </select>
      <ul>{prods.map(p => <li key={p.id}>{p.name} – ₦{p.price}</li>)}</ul>
    </div>
  );
};`,
        notes: "Displays category dropdown; shows products for the selected category."
      },
      {
        label: "Search Products by Name/SKU/Description",
        code: `import { useState } from "react";
const ProductSearch = () => {
  const [q, setQ] = useState(""); const [r, setR] = useState([]);
  const search = () => {
    fetch(\`https://lpcviyjdsgghvuddthxr.supabase.co/functions/v1/get-public-products?q=\${encodeURIComponent(q)}\`)
      .then(res => res.json()).then(setR);
  };
  return (
    <div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search products..." />
      <button onClick={search}>Search</button>
      <ul>{r.map(p => <li key={p.id}>{p.name}</li>)}</ul>
    </div>
  );
};`,
        notes: "Product search by keyword."
      }
    ]
  },
  {
    title: "Shopping Cart & Checkout",
    description: "Complete shopping cart functionality with local storage and checkout flow.",
    examples: [
      {
        label: "Shopping Cart Hook",
        code: `import { useState, useEffect } from "react";
const useCart = () => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem("cart");
    if (saved) setItems(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(items));
  }, [items]);

  const addItem = (product, quantity = 1) => {
    setItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { ...product, quantity }];
    });
  };

  const removeItem = (productId) => {
    setItems(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    setItems(prev =>
      prev.map(item =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => setItems([]);

  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return { items, addItem, removeItem, updateQuantity, clearCart, total };
};`,
        notes: "Complete cart management with localStorage persistence."
      },
      {
        label: "Checkout Form Component",
        code: `import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
const CheckoutForm = ({ cartItems, total, onSuccess }) => {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", address: ""
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const orderData = {
        customer_id: user?.id,
        customer_name: form.name,
        customer_email: form.email,
        customer_phone: form.phone,
        delivery_address: form.address,
        items: cartItems,
        total_amount: total,
        status: 'pending'
      };

      const { error } = await supabase
        .from('orders')
        .insert([orderData]);
      
      if (error) throw error;
      
      onSuccess();
    } catch (error) {
      alert('Checkout failed: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <input
        placeholder="Full Name"
        value={form.name}
        onChange={(e) => setForm({...form, name: e.target.value})}
        className="w-full p-2 border rounded"
        required
      />
      <input
        type="email"
        placeholder="Email"
        value={form.email}
        onChange={(e) => setForm({...form, email: e.target.value})}
        className="w-full p-2 border rounded"
        required
      />
      <input
        placeholder="Phone"
        value={form.phone}
        onChange={(e) => setForm({...form, phone: e.target.value})}
        className="w-full p-2 border rounded"
        required
      />
      <textarea
        placeholder="Delivery Address"
        value={form.address}
        onChange={(e) => setForm({...form, address: e.target.value})}
        className="w-full p-2 border rounded"
        required
      />
      <button type="submit" disabled={loading} className="w-full bg-green-500 text-white p-2 rounded">
        {loading ? "Processing..." : \`Pay ₦\${total.toLocaleString()}\`}
      </button>
    </form>
  );
};`,
        notes: "Complete checkout form that creates orders in Supabase."
      }
    ]
  },
  {
    title: "Orders & Delivery",
    description: "Components for showing customer order and delivery status/history.",
    examples: [
      {
        label: "Customer Order & Delivery History",
        code: `import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
const DeliveryHistory = () => {
  const [orders, setOrders] = useState([]);
  useEffect(() => {
    const fetchOrders = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return;
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("customer_id", user.id)
        .order("order_time", { ascending: false });
      setOrders(data || []);
    };
    fetchOrders();
  }, []);
  return <ul>{orders.map(o => (
    <li key={o.id}>Order #{o.order_number}: {o.status} @ ₦{o.total_amount} ({new Date(o.order_time).toLocaleString()})</li>
  ))}</ul>;
};`,
        notes: "Lists your current user's past orders and delivery status."
      },
      {
        label: "Order Tracking Component",
        code: `import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
const OrderTracking = ({ orderId }) => {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
      
      if (!error) setOrder(data);
      setLoading(false);
    };

    fetchOrder();
    
    // Set up real-time subscription for order updates
    const subscription = supabase
      .channel('order-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: \`id=eq.\${orderId}\`
      }, (payload) => {
        setOrder(payload.new);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [orderId]);

  if (loading) return <div>Loading order details...</div>;
  if (!order) return <div>Order not found</div>;

  const statusSteps = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];
  const currentStep = statusSteps.indexOf(order.status);

  return (
    <div className="p-4">
      <h2>Order #{order.order_number}</h2>
      <div className="mt-4">
        {statusSteps.map((status, index) => (
          <div key={status} className={\`flex items-center \${index <= currentStep ? 'text-green-600' : 'text-gray-400'}\`}>
            <div className={\`w-4 h-4 rounded-full \${index <= currentStep ? 'bg-green-600' : 'bg-gray-300'} mr-2\`} />
            <span className="capitalize">{status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
};`,
        notes: "Real-time order tracking with status visualization."
      }
    ]
  },
  {
    title: "Content & Pages",
    description: "Render dynamic content like About, Terms, FAQ, etc., from Supabase for CMS-style editing.",
    examples: [
      {
        label: "Dynamic Public Content (e.g. About Us)",
        code: `import { usePublicContent } from "@/hooks/usePublicContent";
const AboutPage = () => {
  const { usePublicContentByType } = usePublicContent();
  const { data, isLoading, error } = usePublicContentByType("about_us");
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Failed to load.</div>;
  return <div className="prose max-w-lg" dangerouslySetInnerHTML={{__html: data[0]?.content || ""}} />;
};`,
        notes: "Renders About Us page as editable/public content, supports SEO fields if needed."
      },
      {
        label: "FAQ Component with Dynamic Content",
        code: `import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
const FAQ = () => {
  const [faqs, setFaqs] = useState([]);
  const [openIndex, setOpenIndex] = useState(null);

  useEffect(() => {
    const fetchFAQs = async () => {
      const { data } = await supabase
        .from('content')
        .select('*')
        .eq('type', 'faq')
        .eq('published', true)
        .order('created_at');
      setFaqs(data || []);
    };
    fetchFAQs();
  }, []);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Frequently Asked Questions</h1>
      {faqs.map((faq, index) => (
        <div key={faq.id} className="border-b border-gray-200 py-4">
          <button
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            className="w-full text-left font-medium text-lg hover:text-blue-600"
          >
            {faq.title}
          </button>
          {openIndex === index && (
            <div className="mt-2 text-gray-600" dangerouslySetInnerHTML={{__html: faq.content}} />
          )}
        </div>
      ))}
    </div>
  );
};`,
        notes: "Dynamic FAQ component that loads questions from CMS."
      }
    ]
  },
  {
    title: "Utilities & Other",
    description: "Miscellaneous features, opt-ins, and future improvements.",
    examples: [
      {
        label: "Newsletter Opt-In Component",
        code: `import { useState } from "react";
const NewsletterSignup = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch("/api/subscribe-newsletter", {
        method: "POST",
        body: JSON.stringify({ email }),
        headers: { "Content-Type": "application/json" }
      });
      
      if (response.ok) {
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
      }
    } catch (error) {
      setStatus("error");
    }
    setLoading(false);
  };

  return (
    <div className="bg-gray-50 p-6 rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Stay Updated</h3>
      <p className="text-gray-600 mb-4">Get notified about new products and special offers.</p>
      
      {status === "success" && (
        <div className="bg-green-100 text-green-800 p-2 rounded mb-4">
          Thanks for subscribing!
        </div>
      )}
      
      {status === "error" && (
        <div className="bg-red-100 text-red-800 p-2 rounded mb-4">
          Something went wrong. Please try again.
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          placeholder="Your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 p-2 border rounded"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? "..." : "Subscribe"}
        </button>
      </form>
    </div>
  );
};`,
        notes: "Newsletter subscription with status feedback and validation."
      },
      {
        label: "Customer Review Component",
        code: `import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
const ProductReview = ({ productId, onReviewAdded }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Please login to leave a review");
        return;
      }

      const { error } = await supabase
        .from('reviews')
        .insert([{
          product_id: productId,
          customer_id: user.id,
          rating,
          comment
        }]);

      if (error) throw error;
      
      setComment("");
      setRating(5);
      onReviewAdded?.();
    } catch (error) {
      alert("Failed to submit review: " + error.message);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border p-4 rounded">
      <h4 className="font-semibold">Leave a Review</h4>
      
      <div>
        <label className="block text-sm font-medium mb-1">Rating:</label>
        <div className="flex gap-1">
          {[1,2,3,4,5].map(star => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className={\`text-2xl \${star <= rating ? 'text-yellow-400' : 'text-gray-300'}\`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Comment:</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full p-2 border rounded"
          rows={3}
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 disabled:opacity-50"
      >
        {loading ? "Submitting..." : "Submit Review"}
      </button>
    </form>
  );
};`,
        notes: "Product review component with star rating system."
      }
    ]
  }
];

const additionalFrontendFeatures = [
  "PWA/mobile support for a native app experience",
  "Push notifications for order status updates",
  "Wishlist functionality and favorites",
  "Social media sharing for products",
  "SEO & accessibility optimization",
  "Advanced search with filters (price, category, ratings)",
  "Product comparison functionality",
  "Customer loyalty points and rewards system"
];

const DevelopersCornerTab = () => {
  return (
    <div className="w-full max-w-3xl bg-white rounded-xl border p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Developers Corner</h2>
      <p className="text-gray-600 mb-6">
        Find copyable, real-world React/JS frontend code for integrating with your Supabase APIs. Examples are organized by feature for clarity and fast onboarding.
      </p>
      <Accordion type="multiple" className="mb-8">
        {frontendGroups.map((grp, idx) => (
          <CodeGroupAccordion key={grp.title} grp={grp} idx={idx} />
        ))}
      </Accordion>
      <div className="border-t pt-4 mt-6">
        <div className="bg-purple-50 border-l-4 border-purple-400 p-4 rounded-md">
          <div className="font-bold text-xs mb-1 text-purple-800">Other Highly Recommended Features:</div>
          <ul className="list-disc list-inside text-xs text-gray-700">
            {additionalFrontendFeatures.map((feat) => (
              <li key={feat}>{feat}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DevelopersCornerTab;
