
import React from 'react';

interface CommunicationTogglesProps {
  comm: any;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  loading: boolean;
}

const CommunicationToggles: React.FC<CommunicationTogglesProps> = ({ comm, handleChange, loading }) => {
  return (
    <div className="flex items-center gap-4 pt-4">
      <label className="flex items-center gap-2 cursor-pointer">
        <input 
          type="checkbox" 
          name="enable_sms" 
          checked={!!comm.enable_sms} 
          onChange={handleChange} 
          className="accent-primary h-4 w-4"
          disabled={loading}
        />
        Enable SMS
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input 
          type="checkbox" 
          name="enable_email" 
          checked={!!comm.enable_email} 
          onChange={handleChange} 
          className="accent-primary h-4 w-4"
          disabled={loading}
        />
        Enable Email
      </label>
    </div>
  );
};

export default CommunicationToggles;
