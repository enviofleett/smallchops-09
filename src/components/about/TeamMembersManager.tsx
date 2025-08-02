import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ImageUpload } from '@/components/ui/image-upload';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Plus, Edit, Trash2, User, Mail, Phone, Linkedin } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  position: string;
  bio?: string;
  image_url?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  sort_order: number;
  is_active: boolean;
}

export const TeamMembersManager = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast.error('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (memberData: Partial<TeamMember>) => {
    try {
      if (editingMember) {
        const { error } = await supabase
          .from('team_members')
          .update(memberData)
          .eq('id', editingMember.id);

        if (error) throw error;
        toast.success('Team member updated successfully');
      } else {
        const { error } = await supabase
          .from('team_members')
          .insert({
            ...memberData,
            name: memberData.name || '',
            position: memberData.position || ''
          });

        if (error) throw error;
        toast.success('Team member added successfully');
      }

      setEditingMember(null);
      setIsCreating(false);
      fetchMembers();
    } catch (error) {
      console.error('Error saving team member:', error);
      toast.error('Failed to save team member');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this team member?')) return;

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Team member deleted successfully');
      fetchMembers();
    } catch (error) {
      console.error('Error deleting team member:', error);
      toast.error('Failed to delete team member');
    }
  };

  const toggleActive = async (member: TeamMember) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ 
          is_active: !member.is_active
        })
        .eq('id', member.id);

      if (error) throw error;
      toast.success(`Team member ${member.is_active ? 'deactivated' : 'activated'}`);
      fetchMembers();
    } catch (error) {
      console.error('Error toggling team member:', error);
      toast.error('Failed to update team member');
    }
  };

  if (loading) return <div>Loading team members...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Team Members</h3>
        <Button 
          onClick={() => setIsCreating(true)} 
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Team Member
        </Button>
      </div>

      {(isCreating || editingMember) && (
        <MemberForm
          member={editingMember}
          onSave={handleSave}
          onCancel={() => {
            setEditingMember(null);
            setIsCreating(false);
          }}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {members.map((member) => (
          <Card key={member.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                    {member.image_url ? (
                      <img 
                        src={member.image_url} 
                        alt={member.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{member.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{member.position}</p>
                  </div>
                </div>
                <Badge variant={member.is_active ? "default" : "secondary"}>
                  {member.is_active ? "Active" : "Hidden"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {member.bio && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{member.bio}</p>
              )}
              
              <div className="flex items-center gap-2 mb-3">
                {member.email && (
                  <Mail className="h-4 w-4 text-muted-foreground" />
                )}
                {member.phone && (
                  <Phone className="h-4 w-4 text-muted-foreground" />
                )}
                {member.linkedin_url && (
                  <Linkedin className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              
              <div className="flex justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleActive(member)}
                >
                  {member.is_active ? 'Hide' : 'Show'}
                </Button>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingMember(member)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(member.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

interface MemberFormProps {
  member: TeamMember | null;
  onSave: (data: Partial<TeamMember>) => void;
  onCancel: () => void;
}

const MemberForm: React.FC<MemberFormProps> = ({ member, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: member?.name || '',
    position: member?.position || '',
    bio: member?.bio || '',
    image_url: member?.image_url || '',
    email: member?.email || '',
    phone: member?.phone || '',
    linkedin_url: member?.linkedin_url || '',
    sort_order: member?.sort_order || 0,
    is_active: member?.is_active ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{member ? 'Edit Team Member' : 'Add Team Member'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="position">Position *</Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Brief bio about the team member..."
            />
          </div>

          <div>
            <Label>Profile Photo</Label>
            <ImageUpload
              value={formData.image_url}
              onChange={(file) => setFormData({ ...formData, image_url: file ? URL.createObjectURL(file) : '' })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="team@company.com"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="linkedin_url">LinkedIn URL</Label>
              <Input
                id="linkedin_url"
                value={formData.linkedin_url}
                onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                placeholder="https://linkedin.com/in/username"
              />
            </div>
            <div>
              <Label htmlFor="sort_order">Sort Order</Label>
              <Input
                id="sort_order"
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Active (visible on website)</Label>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">
              <Save className="h-4 w-4 mr-2" />
              Save Member
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};