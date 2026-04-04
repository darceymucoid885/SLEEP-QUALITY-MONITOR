import React, { useEffect, useRef } from 'react';

// Static variables/colors so they're accessible easily
const starColors = ['#00f2fe', '#4facfe', '#ffffff', '#a0aec0'];
const maxDistance = 150; // Distance to draw lines between stars

// Move the class definition OUTSIDE the React component to fix ESLint 'unsupported-syntax'
class Star {
  constructor(width, height) {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.size = Math.random() * 2 + 0.5;
    this.density = (Math.random() * 30) + 1;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.color = starColors[Math.floor(Math.random() * starColors.length)];
  }

  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  }

  update(ctx, width, height, mouse) {
    // Slow drift
    this.x += this.vx;
    this.y += this.vy;

    // Bounce off edges
    if (this.x < 0 || this.x > width) this.vx = -this.vx;
    if (this.y < 0 || this.y > height) this.vy = -this.vy;

    // Mouse interaction (repel)
    if (mouse.x && mouse.y) {
      let dx = mouse.x - this.x;
      let dy = mouse.y - this.y;
      let distance = Math.sqrt(dx * dx + dy * dy);
      let forceDirX = dx / distance;
      let forceDirY = dy / distance;
      let maxDistanceMouse = mouse.radius;
      let force = (maxDistanceMouse - distance) / maxDistanceMouse;
      let dirX = forceDirX * force * this.density;
      let dirY = forceDirY * force * this.density;

      if (distance < mouse.radius) {
        this.x -= dirX;
        this.y -= dirY;
      }
    }
  }
}

const Constellation = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const stars = [];
    const numStars = Math.floor((width * height) / 12000); // Responsive density

    // Mouse interaction
    let mouse = { x: null, y: null, radius: 100 };

    // Init array
    for (let i = 0; i < numStars; i++) {
      stars.push(new Star(width, height));
    }

    // Draw lines between close stars
    function connect() {
      let opacityValue = 1;
      for (let a = 0; a < stars.length; a++) {
        for (let b = a; b < stars.length; b++) {
          let dx = stars[a].x - stars[b].x;
          let dy = stars[a].y - stars[b].y;
          let distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < maxDistance) {
            opacityValue = 1 - (distance / maxDistance);
            ctx.strokeStyle = `rgba(79, 172, 254, ${opacityValue * 0.5})`; // Purple/Cyan glass tint
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(stars[a].x, stars[a].y);
            ctx.lineTo(stars[b].x, stars[b].y);
            ctx.stroke();
          }
        }
      }
    }

    // Animation Loop
    let animationFrameId;
    function animate() {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < stars.length; i++) {
        stars[i].update(ctx, width, height, mouse);
        stars[i].draw(ctx);
      }
      connect();
      animationFrameId = requestAnimationFrame(animate);
    }

    animate();

    // Event Listeners
    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleMouseLeave = () => {
      mouse.x = undefined;
      mouse.y = undefined;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas id="constellation-canvas" ref={canvasRef} />;
};

export default Constellation;
