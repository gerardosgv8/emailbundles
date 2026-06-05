import React from 'react';
import Marquee from 'react-fast-marquee';

export const VerticalMarqueeSection: React.FC = () => {
  // Sample images - you can replace these with your actual images
  const images = [
    'https://images.unsplash.com/photo-1551963831-b3b1ca40c98e?w=400&h=600&fit=crop',
    'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=400&h=600&fit=crop',
    'https://images.unsplash.com/photo-1522770179533-24471fcdba45?w=400&h=600&fit=crop',
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=600&fit=crop',
    'https://images.unsplash.com/photo-1551963831-b3b1ca40c98e?w=400&h=600&fit=crop',
    'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=400&h=600&fit=crop',
  ];

  return (
    <section className="bg-white py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left Side - Content */}
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Beautiful Design Elements
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              Experience our stunning visual components with smooth animations and 
              modern design patterns that captivate your audience.
            </p>
            <p className="text-gray-600 mb-8">
              This section demonstrates a vertical marquee effect with images moving 
              in opposite directions, creating a dynamic and engaging visual experience.
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span className="text-gray-700">Smooth vertical scrolling</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span className="text-gray-700">Bidirectional animation</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span className="text-gray-700">Responsive design</span>
              </div>
            </div>
          </div>

          {/* Right Side - Vertical Marquee */}
          <div className="w-full max-w-full h-[600px] overflow-hidden rounded-lg bg-gray-100 relative isolate">
            <div className="w-full h-full flex gap-2" style={{ maxWidth: '100%' }}>
              {/* Marquee going up */}
              <div className="flex-1 h-full overflow-hidden relative" style={{ maxWidth: '50%', minWidth: 0 }}>
                <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                  <Marquee
                    direction="up"
                    speed={50}
                    gradient={true}
                    gradientColor={[255, 255, 255]}
                    gradientWidth={50}
                    style={{ height: '100%', width: '100%' }}
                  >
                    {images.map((img, index) => (
                      <div key={`up-${index}`} style={{ width: '100%', height: '600px', margin: 0, padding: 0 }}>
                        <img
                          src={img}
                          alt={`Marquee up ${index + 1}`}
                          className="w-full h-full object-cover rounded-lg shadow-md"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', margin: 0 }}
                        />
                      </div>
                    ))}
                  </Marquee>
                </div>
              </div>

              {/* Marquee going down */}
              <div className="flex-1 h-full overflow-hidden relative" style={{ maxWidth: '50%', minWidth: 0 }}>
                <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                  <Marquee
                    direction="down"
                    speed={50}
                    gradient={true}
                    gradientColor={[255, 255, 255]}
                    gradientWidth={50}
                    style={{ height: '100%', width: '100%' }}
                  >
                    {images.map((img, index) => (
                      <div key={`down-${index}`} style={{ width: '100%', height: '600px', margin: 0, padding: 0 }}>
                        <img
                          src={img}
                          alt={`Marquee down ${index + 1}`}
                          className="w-full h-full object-cover rounded-lg shadow-md"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', margin: 0 }}
                        />
                      </div>
                    ))}
                  </Marquee>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

