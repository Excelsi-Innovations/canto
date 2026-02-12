import React, { useState, useEffect } from 'react';
import { Text } from 'ink';

export function Spinner(): React.JSX.Element {
  const [frame, setFrame] = useState(0);
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % frames.length);
    }, 80);
    return () => clearInterval(timer);
  }, [frames.length]);

  return <Text color="cyan">{frames[frame]} </Text>;
}
