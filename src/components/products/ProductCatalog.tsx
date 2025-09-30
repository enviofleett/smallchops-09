// src/components/products/ProductCatalog.tsx
import React from 'react';
import { applyGlobalDiscount } from '../../lib/globalDiscount';

const ProductCatalog = ({ products }) => {
    return (
        <div>
            {products.map(product => (
                <div key={product.id}>
                    <h3>{product.name}</h3>
                    <p>Price: ${applyGlobalDiscount(product.price).toFixed(2)}</p>
                </div>
            ))}
        </div>
    );
};

export default ProductCatalog;
