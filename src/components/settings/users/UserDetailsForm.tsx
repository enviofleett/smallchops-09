
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type UserDetailsFormProps = {
  form: { email: string; password: string; name: string };
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  loading: boolean;
};

const UserDetailsForm = ({ form, handleChange, loading }: UserDetailsFormProps) => {
  return (
    <div className="space-y-4 py-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          value={form.name}
          onChange={handleChange}
          required
          autoFocus
          disabled={loading}
        />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          required
          disabled={loading}
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          required
          disabled={loading}
        />
      </div>
    </div>
  );
};

export default UserDetailsForm;
