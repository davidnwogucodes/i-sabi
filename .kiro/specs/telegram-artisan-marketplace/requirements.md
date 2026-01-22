# Requirements Document

## Introduction

The Telegram-Based Artisan Marketplace is a conversational service platform that connects users with verified artisans (electricians, plumbers, carpenters, cleaners, etc.) through a Telegram bot interface. The system leverages Telegram's ubiquity to reduce friction in finding and booking reliable artisans, featuring a tiered verification system, portfolio showcases, and seamless booking flow with LLM-powered natural language processing.

## Requirements

### Requirement 1: User Discovery and Service Selection

**User Story:** As a user, I want to discover and select artisan services through an intuitive Telegram bot interface, so that I can quickly find help without downloading additional apps.

#### Acceptance Criteria

1. WHEN a user sends /start to the bot THEN the system SHALL display service categories via inline keyboard buttons
2. WHEN a user selects a service category THEN the system SHALL prompt for natural language description of their issue
3. WHEN a user describes their issue THEN the system SHALL use LLM processing to parse intent and requirements
4. WHEN the system processes the user's request THEN it SHALL suggest nearby artisans with tier badges, ratings, and experience summaries
5. IF no artisans are available in the user's area THEN the system SHALL notify the user and suggest expanding search radius

### Requirement 2: Artisan Portfolio and Trust Verification

**User Story:** As a user, I want to view artisan portfolios and credentials before booking, so that I can make informed decisions based on their work quality and experience.

#### Acceptance Criteria

1. WHEN a user clicks "View Top 5 Work" on an artisan listing THEN the system SHALL open a mobile-optimized web page showing the artisan's portfolio
2. WHEN displaying artisan listings THEN the system SHALL show tier badge (Foundation, Professional, Elite), rating, and experience summary
3. WHEN showing artisan portfolios THEN the system SHALL display Top 5 completed works with images, descriptions, project scale, and client type
4. WHEN a user views a portfolio page THEN it SHALL include a "Book This Artisan" button that deep-links back to the Telegram bot
5. WHEN displaying artisan information THEN the system SHALL show verified credentials and tier justification

### Requirement 3: Booking and Scheduling System

**User Story:** As a user, I want to schedule and confirm bookings with selected artisans through the bot, so that I can secure services without leaving the Telegram interface.

#### Acceptance Criteria

1. WHEN a user selects an artisan THEN the system SHALL present available time slots for scheduling
2. WHEN a user confirms a booking THEN the system SHALL send confirmation messages to both user and artisan
3. WHEN a booking is confirmed THEN the system SHALL send automated reminders before the scheduled service
4. WHEN a service is completed THEN the system SHALL prompt the user to rate and review the artisan
5. IF a booking needs to be cancelled THEN the system SHALL handle cancellation with appropriate notifications

### Requirement 4: Artisan Tier Management System

**User Story:** As the system, I want to automatically evaluate and assign tier levels to artisans based on objective criteria, so that users can trust the quality indicators.

#### Acceptance Criteria

1. WHEN evaluating artisan tiers THEN the system SHALL consider years of professional experience, project scale, client reputation, job success rate, user ratings, and portfolio quality
2. WHEN an artisan registers THEN the system SHALL assign them to Foundation tier initially
3. WHEN an artisan's metrics improve THEN the system SHALL automatically promote them to Professional or Elite tiers
4. WHEN displaying artisans THEN the system SHALL show tier badges with clear visual distinction
5. IF an artisan's performance degrades THEN the system SHALL demote their tier level accordingly

### Requirement 5: Natural Language Processing Integration

**User Story:** As a user, I want to describe my service needs in natural language, so that the system can understand and match me with appropriate artisans without complex forms.

#### Acceptance Criteria

1. WHEN a user describes their issue in natural language THEN the system SHALL use OpenRouter LLM API to parse intent and extract key requirements
2. WHEN processing user input THEN the system SHALL identify service type, urgency level, location, and specific requirements
3. WHEN LLM processing fails THEN the system SHALL fall back to category-based selection
4. WHEN ambiguous requests are received THEN the system SHALL ask clarifying questions through the bot
5. WHEN user intent is parsed THEN the system SHALL use extracted information to filter and rank artisan suggestions

### Requirement 6: Payment and Transaction Management

**User Story:** As a user, I want to pay for completed services via bank transfer, so that I can complete transactions securely.

#### Acceptance Criteria

1. WHEN a service is completed THEN the system SHALL provide artisan's bank transfer details to the user
2. WHEN bank transfer details are shared THEN the system SHALL include booking reference number for payment identification
3. WHEN payment is completed THEN the user SHALL confirm payment through the bot
4. WHEN payment confirmation is received THEN the system SHALL update booking status and notify both parties
5. IF payment disputes arise THEN the system SHALL provide dispute resolution workflow with transfer receipt verification

### Requirement 7: Artisan Management and Onboarding

**User Story:** As an artisan, I want to register, manage my profile, and receive bookings through the platform, so that I can grow my business and reach more customers.

#### Acceptance Criteria

1. WHEN an artisan registers THEN the system SHALL collect professional credentials, experience details, and portfolio samples
2. WHEN artisans update their profiles THEN the system SHALL re-evaluate their tier status
3. WHEN bookings are made THEN the system SHALL notify artisans and allow them to accept or decline
4. WHEN artisans complete jobs THEN the system SHALL prompt them to mark completion and request payment
5. IF artisans want to upgrade their tier THEN the system SHALL provide clear criteria and progress tracking

### Requirement 8: Administrative and Monetization Features

**User Story:** As a platform administrator, I want to manage the marketplace, collect commissions, and provide premium features, so that the platform can be sustainable and profitable.

#### Acceptance Criteria

1. WHEN bookings are completed THEN the system SHALL calculate and collect commission fees
2. WHEN artisans subscribe to tier-based plans THEN the system SHALL provide enhanced visibility and features
3. WHEN Elite artisans pay for featured placement THEN the system SHALL prioritize them in search results
4. WHEN corporate clients register THEN the system SHALL provide bulk booking and contract management features
5. WHEN generating reports THEN the system SHALL provide analytics on bookings, revenue, and user engagement