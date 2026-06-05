import React from 'react';

export const TestimonialsSection: React.FC = () => {
  const testimonials = [
    {
      quote: "The templates imported flawlessly into Salesforce. Our CTR went up 18%.",
      author: "— Marcos, eCommerce Manager"
    },
    {
      quote: "No more Outlook nightmares. The VML buttons are rock-solid.",
      author: "— Priya, Marketing Lead"
    },
    {
      quote: "Fast to implement and look polished — perfect for our small team.",
      author: "— Jorge, Founder"
    }
  ];

  return (
    <section id="testimonials" className="mx-auto max-w-6xl px-6 py-12">
      <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">What customers say</h3>
      <div className="mt-6 grid gap-6 md:grid-cols-3">
        {testimonials.map((testimonial, index) => (
          <div
            key={index}
            className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900 dark:shadow-none dark:ring-1 dark:ring-gray-800"
          >
            <p className="text-gray-800 dark:text-gray-200">"{testimonial.quote}"</p>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-500">{testimonial.author}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
