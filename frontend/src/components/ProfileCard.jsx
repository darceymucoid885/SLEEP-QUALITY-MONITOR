import React, { useState } from 'react';
import GlassCard from './GlassCard';
import { User, Activity, Edit3 } from 'lucide-react';

const ProfileCard = ({ profile, setProfile }) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    setIsEditing(false);
    // In a real app we would POST to the backend
  };

  return (
    <GlassCard>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
          <User size={18} /> User Profile
        </h3>
        <button 
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          style={{ 
            background: 'transparent', 
            border: 'none', 
            color: 'var(--accent-cyan)', 
            cursor: 'pointer',
            display: 'flex', gap: '4px', alignItems: 'center',
            fontSize: '0.85rem'
          }}
        >
          {isEditing ? 'Save' : <><Edit3 size={14} /> Edit</>}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Name</label>
          {isEditing ? (
            <input 
              className="glass-input" 
              value={profile.name} 
              onChange={e => setProfile({...profile, name: e.target.value})}
              style={{ padding: '8px 12px', fontSize: '1rem', color: '#fff' }}
            />
          ) : (
            <div style={{ fontSize: '1.1rem', fontWeight: '500' }}>{profile.name}</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Age (Rule Anchor)</label>
            {isEditing ? (
              <input 
                type="number"
                className="glass-input" 
                value={profile.age} 
                onChange={e => setProfile({...profile, age: e.target.value})}
                style={{ padding: '8px 12px', fontSize: '1rem', color: '#fff' }}
              />
            ) : (
              <div style={{ fontSize: '1.1rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {profile.age} <span className="status-badge status-GOOD" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>{Number(profile.age) <= 12 ? 'CHILD' : Number(profile.age) <= 19 ? 'TEEN' : Number(profile.age) <= 39 ? 'YOUNG' : Number(profile.age) <= 59 ? 'MID' : Number(profile.age) <= 75 ? 'OLDER' : 'ELDERLY'}</span>
              </div>
            )}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Gender</label>
            {isEditing ? (
              <select 
                className="glass-input"
                value={profile.gender}
                onChange={e => setProfile({...profile, gender: e.target.value})}
                style={{ padding: '8px 12px', fontSize: '1rem', color: '#fff' }}
              >
                <option value="Male" style={{ background: 'var(--bg-color-2)' }}>Male</option>
                <option value="Female" style={{ background: 'var(--bg-color-2)' }}>Female</option>
                <option value="Other" style={{ background: 'var(--bg-color-2)' }}>Other</option>
              </select>
            ) : (
              <div style={{ fontSize: '1.1rem', fontWeight: '500' }}>{profile.gender}</div>
            )}
          </div>
        </div>

      </div>
    </GlassCard>
  );
};

export default ProfileCard;
