// src/pages/ProductDetail.tsx
import React from 'react';
import { applyGlobalDiscount } from '../lib/globalDiscount';

const ProductDetail = ({ product }) => {
    return (
        <div>
            <h1>{product.name}</h1>
            <p>Price: ${applyGlobalDiscount(product.price).toFixed(2)}</p>
        </div>
    );
};

export default ProductDetail;
