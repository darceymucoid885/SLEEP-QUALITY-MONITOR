import React, { useEffect, useState } from 'react';
import { AlertTriangle, Droplet, X } from 'lucide-react';
import './HydrationAlertPopup.css';

const HydrationAlertPopup = ({ alert, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (alert) {
      setVisible(true);
      // Auto-hide after 15 seconds unless it's High Risk
      if (alert.type !== 'HIGH_RISK') {
        const timer = setTimeout(() => {
          handleClose();
        }, 15000);
        return () => clearTimeout(timer);
      }
    }
  }, [alert]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
      if (onClose) onClose();
    }, 300); // Wait for transition
  };

  if (!alert && !visible) return null;

  const isStrong = alert?.type === 'HIGH_RISK';
  
  return (
    <div className={`hydration-popup-container ${visible ? 'show' : ''} ${isStrong ? 'strong' : 'mild'}`}>
      <div className="popup-icon-wrapper">
        {isStrong ? <AlertTriangle size={32} color="#ff4b4b" /> : <Droplet size={32} color="#00f2fe" />}
      </div>
      
      <div className="popup-content">
        <h4>{isStrong ? '🚨 Dehydration Warning' : '⚠️ Hydration Alert'}</h4>
        <p className="message-body">
          {alert?.message?.split('\n').map((line, i) => (
             <span key={i} style={{display: 'block', marginBottom: line === '' ? '8px' : '0'}}>{line}</span>
          ))}
        </p>
        <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-cyan)' }}></div>
          Alert successfully pushed to registered mobile device.
        </div>
      </div>
      
      <button className="popup-close-btn" onClick={handleClose}>
        <X size={20} />
      </button>
    </div>
  );
};

export default HydrationAlertPopup;
