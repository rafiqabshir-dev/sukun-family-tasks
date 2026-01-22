import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { useRef, useEffect, useState } from "react";
import Svg, { G, Path, Text as SvgText, Circle, Defs, LinearGradient, Stop, TextPath } from "react-native-svg";
import { colors } from "@/lib/theme";

interface WheelSegment {
  id: string;
  label: string;
  color: string;
  value?: number;
  avatar?: string;
}

interface FamilyWheelProps {
  segments: WheelSegment[];
  spinning: boolean;
  onSpinComplete: (segment: WheelSegment) => void;
  size?: number;
  spinDuration?: number;
}

const PASTEL_COLORS = [
  "#FFB5BA", // Pink
  "#B5E8C3", // Green  
  "#FFE5A0", // Yellow
  "#B5D8FF", // Blue
  "#E5B5FF", // Purple
  "#FFD5B5", // Orange
  "#B5FFE5", // Mint
  "#FFB5E5", // Rose
];

export function FamilyWheel({ 
  segments, 
  spinning, 
  onSpinComplete, 
  size = 280,
  spinDuration = 3000 
}: FamilyWheelProps) {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const prevSpinning = useRef(false);

  const radius = size / 2;
  const centerX = radius;
  const centerY = radius;
  const innerRadius = radius * 0.15;

  useEffect(() => {
    if (spinning && !prevSpinning.current && segments.length > 0) {
      const randomIndex = Math.floor(Math.random() * segments.length);
      setSelectedIndex(randomIndex);
      
      const segmentAngle = 360 / segments.length;
      const targetAngle = 360 - (randomIndex * segmentAngle + segmentAngle / 2);
      const totalRotation = 360 * 5 + targetAngle;

      rotateAnim.setValue(0);
      Animated.timing(rotateAnim, {
        toValue: totalRotation,
        duration: spinDuration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        onSpinComplete(segments[randomIndex]);
      });
    }
    prevSpinning.current = spinning;
  }, [spinning, segments]);

  const createWedgePath = (index: number, total: number): string => {
    const angle = 360 / total;
    const startAngle = index * angle - 90;
    const endAngle = startAngle + angle;
    
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    const x1 = centerX + (radius - 10) * Math.cos(startRad);
    const y1 = centerY + (radius - 10) * Math.sin(startRad);
    const x2 = centerX + (radius - 10) * Math.cos(endRad);
    const y2 = centerY + (radius - 10) * Math.sin(endRad);
    
    const ix1 = centerX + innerRadius * Math.cos(startRad);
    const iy1 = centerY + innerRadius * Math.sin(startRad);
    const ix2 = centerX + innerRadius * Math.cos(endRad);
    const iy2 = centerY + innerRadius * Math.sin(endRad);
    
    const largeArcFlag = angle > 180 ? 1 : 0;
    
    return `M ${ix1} ${iy1} L ${x1} ${y1} A ${radius - 10} ${radius - 10} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${ix1} ${iy1} Z`;
  };

  const getTextPosition = (index: number, total: number) => {
    const angle = 360 / total;
    const midAngle = index * angle + angle / 2 - 90;
    const midRad = (midAngle * Math.PI) / 180;
    const avatarRadius = radius * 0.48; // Avatar position (more inward)
    
    // Base tangential rotation
    let rotation = midAngle + 90;
    
    // Check if segment is in bottom half (between 90° and 270° in standard coords)
    const normalizedAngle = ((midAngle + 90) % 360 + 360) % 360;
    const isBottomHalf = normalizedAngle > 90 && normalizedAngle < 270;
    
    // Flip text 180° if in bottom half so it reads upright
    if (isBottomHalf) {
      rotation += 180;
    }
    
    return {
      x: centerX + avatarRadius * Math.cos(midRad),
      y: centerY + avatarRadius * Math.sin(midRad),
      rotation,
      isFlipped: isBottomHalf,
    };
  };

  // Create arc path for curved text
  const createTextArcPath = (index: number, total: number, isBottomHalf: boolean): string => {
    const angle = 360 / total;
    const startAngle = index * angle - 90;
    const endAngle = startAngle + angle;
    const textArcRadius = radius * 0.82; // Arc for curved text (pushed to outer edge)
    
    // Add padding from edges
    const padding = angle * 0.12;
    const paddedStart = startAngle + padding;
    const paddedEnd = endAngle - padding;
    
    const startRad = (paddedStart * Math.PI) / 180;
    const endRad = (paddedEnd * Math.PI) / 180;
    
    const x1 = centerX + textArcRadius * Math.cos(startRad);
    const y1 = centerY + textArcRadius * Math.sin(startRad);
    const x2 = centerX + textArcRadius * Math.cos(endRad);
    const y2 = centerY + textArcRadius * Math.sin(endRad);
    
    // For bottom half, reverse the arc direction so text reads correctly
    if (isBottomHalf) {
      return `M ${x2} ${y2} A ${textArcRadius} ${textArcRadius} 0 0 0 ${x1} ${y1}`;
    }
    return `M ${x1} ${y1} A ${textArcRadius} ${textArcRadius} 0 0 1 ${x2} ${y2}`;
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  if (segments.length === 0) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <View style={styles.emptyWheel}>
          <Text style={styles.emptyText}>No members yet</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size + 40 }]}>
      <View style={styles.pointer}>
        <View style={styles.pointerTriangle} />
      </View>
      
      <View style={styles.wheelFrame}>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Defs>
              <LinearGradient id="wheelBorder" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#FFD700" />
                <Stop offset="50%" stopColor="#FFA500" />
                <Stop offset="100%" stopColor="#FFD700" />
              </LinearGradient>
            </Defs>
            
            <Circle 
              cx={centerX} 
              cy={centerY} 
              r={radius - 5} 
              fill="none" 
              stroke="url(#wheelBorder)" 
              strokeWidth={8} 
            />
            
            <G>
              {segments.map((segment, index) => (
                <Path
                  key={segment.id}
                  d={createWedgePath(index, segments.length)}
                  fill={segment.color || PASTEL_COLORS[index % PASTEL_COLORS.length]}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
              ))}
            </G>
            
            {/* Define curved text paths */}
            <Defs>
              {segments.map((segment, index) => {
                const pos = getTextPosition(index, segments.length);
                return (
                  <Path
                    key={`textpath-${segment.id}`}
                    id={`textarc-${index}`}
                    d={createTextArcPath(index, segments.length, pos.isFlipped)}
                    fill="none"
                  />
                );
              })}
            </Defs>
            
            <G>
              {segments.map((segment, index) => {
                const pos = getTextPosition(index, segments.length);
                const hasAvatar = !!segment.avatar;
                
                // Full first name (curved text gives more space)
                const firstName = segment.label.split(' ')[0];
                const baseFontSize = segments.length > 6 ? 9 : segments.length > 4 ? 10 : 11;
                const avatarSize = segments.length > 6 ? 32 : segments.length > 4 ? 38 : 44;
                
                // Calculate rotation to point avatar head towards the arc
                const angle = 360 / segments.length;
                const midAngle = index * angle + angle / 2 - 90;
                const avatarRotation = midAngle + 90; // Head points outward
                
                return (
                  <G key={`content-${segment.id}`}>
                    {hasAvatar ? (
                      <>
                        {/* Big centered avatar - rotated to face outward */}
                        <SvgText
                          x={pos.x}
                          y={pos.y}
                          fill="#5D4037"
                          fontSize={avatarSize}
                          textAnchor="middle"
                          alignmentBaseline="middle"
                          transform={`rotate(${avatarRotation}, ${pos.x}, ${pos.y})`}
                        >
                          {segment.avatar}
                        </SvgText>
                        {/* Curved name along arc */}
                        <SvgText
                          fill="#5D4037"
                          fontSize={baseFontSize}
                          fontWeight="bold"
                        >
                          <TextPath
                            href={`#textarc-${index}`}
                            startOffset="50%"
                            textAnchor="middle"
                          >
                            {firstName}
                          </TextPath>
                        </SvgText>
                      </>
                    ) : segment.value !== undefined ? (
                      <>
                        {/* Star value centered */}
                        <SvgText
                          x={pos.x}
                          y={pos.y}
                          fill="#FFD700"
                          fontSize={baseFontSize + 14}
                          fontWeight="bold"
                          textAnchor="middle"
                          alignmentBaseline="middle"
                          stroke="#5D4037"
                          strokeWidth={1.5}
                        >
                          {segment.value}
                        </SvgText>
                        {/* Curved name along arc */}
                        <SvgText
                          fill="#5D4037"
                          fontSize={baseFontSize - 2}
                          fontWeight="bold"
                        >
                          <TextPath
                            href={`#textarc-${index}`}
                            startOffset="50%"
                            textAnchor="middle"
                          >
                            {firstName}
                          </TextPath>
                        </SvgText>
                      </>
                    ) : (
                      <SvgText
                        fill="#5D4037"
                        fontSize={baseFontSize}
                        fontWeight="bold"
                      >
                        <TextPath
                          href={`#textarc-${index}`}
                          startOffset="50%"
                          textAnchor="middle"
                        >
                          {firstName}
                        </TextPath>
                      </SvgText>
                    )}
                  </G>
                );
              })}
            </G>
            
            <Circle 
              cx={centerX} 
              cy={centerY} 
              r={innerRadius + 5} 
              fill="#FFF8E1" 
              stroke="#FFD700"
              strokeWidth={3}
            />
          </Svg>
        </Animated.View>
      </View>
      
      <View style={styles.wheelStand}>
        <View style={styles.standBase} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  wheelFrame: {
    borderRadius: 999,
    padding: 5,
    backgroundColor: "#FFF8E1",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  pointer: {
    position: "absolute",
    top: 0,
    zIndex: 10,
    alignItems: "center",
  },
  pointerTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 15,
    borderRightWidth: 15,
    borderBottomWidth: 30,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#FFD700",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  wheelStand: {
    position: "absolute",
    bottom: 0,
    alignItems: "center",
  },
  standBase: {
    width: 80,
    height: 20,
    backgroundColor: "#8BC34A",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  emptyWheel: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 8,
    borderColor: "#E0E0E0",
  },
  emptyText: {
    color: "#9E9E9E",
    fontSize: 16,
  },
});
