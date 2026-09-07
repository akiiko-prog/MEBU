import React, { useMemo, useRef } from 'react';
import Reanimated, { AnimatedProps, LinearTransition, withDelay, withSpring } from 'react-native-reanimated';

import Typography, { TypographyProps } from './Typography';

interface AnimatedNumberProps extends TypographyProps {
  distance?: number; // Distance to translate the number
  duration?: number; // Duration of the animation
  dampingRatio?: number; // Damping ratio of the animation
  disableMoveAnimation?: boolean; // Désactivé la transition linéaire
}

const AnimatedView = Reanimated.View as React.ComponentType<AnimatedProps<React.ComponentProps<typeof Reanimated.View>>>;

function AnimatedNumber({
  children,
  distance = 12,
  duration = 700,
  dampingRatio = 0.55,
  disableMoveAnimation = false,
  ...rest
}: AnimatedNumberProps) {
  try {
    const value = useMemo(() => (children?.toString ? children.toString().trim() : ''), [children]);
    const digits = useMemo(() => value.split(''), [value]);

    const prevDigitsRef = useRef<string[]>(digits);
    React.useEffect(() => {
      prevDigitsRef.current = digits;
    }, [value]);

    const { unchangedArr, changedIndexArr } = useMemo(() => {
      const prevDigits = prevDigitsRef.current;
      const unchangedArr: boolean[] = [];
      const changedIndexArr: number[] = [];
      let changedCounter = 0;

      for (let idx = 0; idx < digits.length; idx++) {
        const isUnchanged = prevDigits[idx] === digits[idx];
        unchangedArr.push(isUnchanged);
        changedIndexArr.push(isUnchanged ? -1 : changedCounter++);
      }

      return { unchangedArr, changedIndexArr };
    }, [digits]);

    const getNumberEntering = useMemo(() => {
      return (changedIndex: number, unchanged: boolean) => () => {
        'worklet';
        const delay = unchanged ? 60 : changedIndex * 60;
        return {
          initialValues: {
            opacity: 0,
            transform: [{ translateY: distance }, { scale: 0.4 }],
          },
          animations: {
            opacity: withDelay(delay, withSpring(1, { duration: duration / 2 })),
            transform: [
              { translateY: withDelay(delay, withSpring(0, { duration, dampingRatio })) },
              { scale: withDelay(delay, withSpring(1, { duration, dampingRatio })) },
            ],
          },
        };
      };
    }, [distance, duration]);

    const getNumberExiting = useMemo(() => {

      return (changedIndex: number, unchanged: boolean) => () => {
        'worklet';
        const delay = unchanged ? 0 : changedIndex * 60;
        return {
          initialValues: {
            opacity: 1,
            transform: [{ translateY: 0 }, { scale: 1 }],
          },
          animations: {
            opacity: withDelay(delay, withSpring(0, { duration, dampingRatio })),
            transform: [
              { translateY: withDelay(delay, withSpring(-distance, { duration, dampingRatio })) }, // Use -distance for upward exit
              { scale: withDelay(delay, withSpring(0.5, { duration, dampingRatio })) },
            ],
          },
        };
      };
    }, [distance, duration]);

    return (
      <AnimatedView
        layout={disableMoveAnimation ? undefined : LinearTransition.springify()}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {digits.map((digit, index) => {
          const unchanged = unchangedArr[index];
          const changedIndex = changedIndexArr[index];

          return (
            <AnimatedView
              key={`animated - number - ${digit} -${index} `}
              layout={(digit === "." || digit === ",") ? LinearTransition.springify() : undefined}
              entering={getNumberEntering(changedIndex, unchanged)}
              exiting={getNumberExiting(changedIndex, unchanged)}
            >
              <Typography {...rest}>{digit}</Typography>
            </AnimatedView>
          );
        })}
      </AnimatedView>
    );
  }
  catch (error) {
    console.error("Error in AnimatedNumber:", error);
    return <Typography {...rest}>{children}</Typography>;
  }
}

export default React.memo(AnimatedNumber);