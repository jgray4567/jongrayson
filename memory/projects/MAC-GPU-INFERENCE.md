# Mac GPU Inference

## Idea source
- Video: `I Plugged an RTX 5090 Into a Mac... and Didn’t Expect This`
- URL: `https://youtu.be/C4KWsmezXm4?si=N7OOFtZEK-kkAdMO`

## Core driver / solution
- The key enabling tech is **Tiny Corp's open-source Tiny GPU macOS kernel extension / driver work**, which allows an Apple Silicon Mac to use an external NVIDIA (and potentially AMD) GPU over Thunderbolt again.

## Why this matters
- It suggests a path to combine the Apple Silicon/Mac ecosystem with discrete external GPU inference.
- It could become an interesting solution for local AI, LLM inference, and experimental workstation setups without fully abandoning a Mac-based environment.

## Key items from the video
- This is framed as the first meaningful return of NVIDIA GPU support on Macs since Apple moved away from official support.
- The setup demonstrated an **external RTX 5090** attached to a Mac.
- The current result is a **working proof of concept**, not yet the highest-performance production stack.
- Benchmark takeaway: it can beat some Apple Metal baselines in certain end-to-end tests, but it is still behind highly optimized local runtimes like LlamaCPP on Metal because the Tiny kernels are still immature.
- The main limitation right now appears to be **software optimization**, not the basic feasibility of the architecture.

## JerryKnows / Jon relevance
- If this driver stack matures, it could create a compelling future path for a Mac-first AI workstation that also gains access to stronger external GPU inference.
- This is worth tracking as a side-project / infrastructure idea, especially given interest in a Mac Studio as the private JK AI engine.

## Watchlist / revisit triggers
- better benchmark stability against mature Metal / LlamaCPP stacks
- clearer production reliability on Apple Silicon
- broader model/runtime compatibility
- easier setup and persistence
- evidence that the driver stack is no longer just a proof of concept

## Docs created
- `mac-studio-tiny-gpu-implications.md`
- Google Doc: `Mac Studio + Tiny GPU Implications`

## Status
- Transcript extracted
- Idea committed to durable memory
- Practical Mac Studio implications note created
- Worth revisiting later as Tiny GPU matures
