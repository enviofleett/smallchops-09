// src/pages/PublicProducts.tsx
import React from 'react';
import { applyGlobalDiscount } from '../lib/globalDiscount';

const PublicProducts = ({ products }) => {
    return (
        <div>
            {products.map(product => (
                <div key={product.id}>
                    <h2>{product.name}</h2>
                    <p>Price: ${applyGlobalDiscount(product.price).toFixed(2)}</p>
                </div>
            ))}
        </div>
    );
};

export default PublicProducts;
